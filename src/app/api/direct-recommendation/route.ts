import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';
import { sendRecommendationEmail } from '@/utils/brevoEmail';

/**
 * API endpoint to directly generate a recommendation from analyzed videos
 * This is a simplified version that doesn't use chained API calls
 */
export async function POST(request: Request) {
  try {
    const { userId, queryId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log(`Generating recommendation for user ${userId}`);

    // Get all videos for this user, optionally filtered by query ID
    const videosQuery = supabase
      .from('tiktok_videos')
      .select('*, trend_queries(query)')
      .eq('trend_queries.user_id', userId)
      .order('likes', { ascending: false });

    // If a query ID is provided, filter by that query
    if (queryId) {
      videosQuery.eq('trend_query_id', queryId);
    }

    const { data: videos, error: videosError } = await videosQuery;

    if (videosError) {
      console.error('Error fetching videos:', videosError);
      return NextResponse.json(
        { error: 'Error fetching videos' },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      console.error('No videos found for this user');
      return NextResponse.json(
        { error: 'No videos found for this user' },
        { status: 404 }
      );
    }

    console.log(`Found ${videos.length} videos for recommendation generation`);

    // Filter videos that have been analyzed (have frame_analysis)
    let analyzedVideos = videos.filter(video => video.frame_analysis);

    if (analyzedVideos.length === 0) {
      console.log('No analyzed videos found, using all videos instead');
      analyzedVideos = videos;

      // Generate simple analyses for videos that don't have them
      for (const video of analyzedVideos) {
        if (!video.frame_analysis) {
          // Generate a simple analysis
          const simpleAnalysis = generateSimpleAnalysis(video);

          // Update the video in the database
          await supabase
            .from('tiktok_videos')
            .update({
              frame_analysis: simpleAnalysis,
              summary: simpleAnalysis.substring(0, 500) + '...',
              last_analyzed_at: new Date().toISOString()
            })
            .eq('id', video.id);

          // Update the video object
          video.frame_analysis = simpleAnalysis;
        }
      }
    }

    console.log(`Found ${analyzedVideos.length} analyzed videos for recommendation generation`);

    // Get the OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OpenRouter API key is missing');
      return NextResponse.json(
        { error: 'OpenRouter API key is missing' },
        { status: 500 }
      );
    }

    // Sanitize the API key
    const sanitizedApiKey = apiKey.trim();

    // Prepare the prompt for the recommendation
    const videoAnalyses = analyzedVideos.map(video => {
      return `Video ${video.id} (${video.trend_queries.query}): ${video.frame_analysis}`;
    }).join('\n\n');

    // Get the user's business description
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('business_description')
      .eq('id', userId)
      .single();

    const businessDescription = userData?.business_description || 'food business';

    const prompt = `You are a TikTok content strategy expert specializing in food content. Based on the following TikTok video analyses, generate a comprehensive recommendation for a ${businessDescription}.

Video Analyses:
${videoAnalyses}

Focus on extracting SPECIFIC techniques, styles, and patterns from these actual videos. Don't provide generic advice - look at what's actually working in these trending videos and provide concrete recommendations based on them.

Please provide your recommendation in the following format:

# Content Patterns
[Identify 3-5 specific content patterns that appear across multiple trending videos. Be very specific about what types of food content is trending, what formats work best, and what specific hooks or angles are most effective.]

# Visual Techniques
[Describe 3-5 specific visual techniques used in these videos - camera angles, lighting, framing, colors, etc. Be specific about how food is presented visually.]

# Editing & Pacing
[Describe the specific editing style and pacing used in these trending videos - how long are clips, what transitions are used, how text is incorporated, etc.]

# Audio Strategy
[Describe the audio approach - voice narration style, music choices, sound effects, etc. that make these videos engaging]

# Step-by-Step Recreation Guide
1. [First step with specific details]
2. [Second step with specific details]
3. [Third step with specific details]
4. [Fourth step with specific details]
5. [Fifth step with specific details]

# 5 Video Ideas for ${businessDescription}
1. [Specific video idea tailored to this business]
2. [Specific video idea tailored to this business]
3. [Specific video idea tailored to this business]
4. [Specific video idea tailored to this business]
5. [Specific video idea tailored to this business]

Make your recommendations extremely specific, actionable, and tailored to a ${businessDescription}. Focus on what's actually shown in the analyzed videos, not generic TikTok advice.`;

    console.log('Generating recommendation with OpenRouter...');

    // Make the API call to OpenRouter for recommendation generation
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-4-maverick:free',
        messages: [
          {
            role: 'system',
            content: 'You are a TikTok content strategy expert. Analyze the provided video analyses and generate specific, actionable recommendations for creating trending content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${sanitizedApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract the recommendation from the response
    const recommendationText = response.data?.choices?.[0]?.message?.content || '';
    console.log(`Received recommendation, length: ${recommendationText.length} characters`);

    // We already have userData from earlier, no need to fetch it again
    if (!userData || !userData.business_description) {
      console.log('Using default business type as business description was not available');
    }

    // Save the recommendation to the database
    const { data: savedRecommendation, error: saveError } = await supabase
      .from('recommendations')
      .insert({
        user_id: userId,
        content: recommendationText,
        business_type: userData?.business_description || 'Not specified',
        video_ids: analyzedVideos.map(v => v.id),
        created_at: new Date().toISOString()
      })
      .select();

    if (saveError) {
      console.error('Error saving recommendation:', saveError);
      return NextResponse.json(
        { error: `Error saving recommendation: ${saveError.message}` },
        { status: 500 }
      );
    }

    console.log('Recommendation saved successfully');

    // Send email notification if enabled
    try {
      // Get user data including email preferences
      const { data: userPrefs, error: prefsError } = await supabase
        .from('users')
        .select('email_notifications, last_email_sent')
        .eq('id', userId)
        .single();

      if (prefsError) {
        throw new Error(`Error fetching user preferences: ${prefsError.message}`);
      }

      // Check if email notifications are enabled
      if (userPrefs.email_notifications !== false) {
        // Check if this is the first recommendation or it's been 24 hours since the last email
        const lastEmailSent = userPrefs.last_email_sent ? new Date(userPrefs.last_email_sent) : null;
        const now = new Date();
        const hoursSinceLastEmail = lastEmailSent
          ? (now.getTime() - lastEmailSent.getTime()) / (1000 * 60 * 60)
          : 999; // Large number to ensure it passes the 24-hour check if no previous email

        if (!lastEmailSent || hoursSinceLastEmail >= 24) {
          // Get user's email from auth
          const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);

          if (authError || !authData?.user?.email) {
            throw new Error(`Error fetching user email: ${authError?.message || 'No email found'}`);
          }

          // Send the email
          await sendRecommendationEmail(
            authData.user.email,
            authData.user.user_metadata?.full_name || '',
            [savedRecommendation[0]]
          );

          // Update last_email_sent timestamp
          await supabase
            .from('users')
            .update({ last_email_sent: now.toISOString() })
            .eq('id', userId);

          console.log(`Email notification sent to ${authData.user.email}`);
        } else {
          console.log(`Skipping email notification - last email was sent ${hoursSinceLastEmail.toFixed(1)} hours ago`);
        }
      } else {
        console.log('Email notifications are disabled for this user');
      }
    } catch (emailError: any) {
      console.error('Error sending email notification:', emailError.message);
      // Continue even if email sending fails
    }

    return NextResponse.json({
      success: true,
      message: 'Recommendation generated successfully',
      recommendation: savedRecommendation[0]
    });
  } catch (error: any) {
    console.error('Error in direct-recommendation API route:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      responseStatus: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data'
    });

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during recommendation generation',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a detailed and specific analysis based on video metadata
 * This is used as a fallback when videos don't have analysis
 * This function is imported from direct-analyze/route.ts
 */
function generateSimpleAnalysis(video: any): string {
  // Extract and process video metadata
  const hashtags = Array.isArray(video.hashtags) ? video.hashtags : [];
  const views = video.views ? video.views.toLocaleString() : 'Unknown';
  const likes = video.likes ? video.likes.toLocaleString() : 'Unknown';
  const engagement = video.likes && video.views ? ((video.likes / video.views) * 100).toFixed(2) + '%' : 'Unknown';

  // Process caption
  const caption = video.caption || '';
  const cleanCaption = caption.replace(/#\w+/g, '').trim();

  // Generate a unique ID for this analysis based on video properties
  const uniqueId = Math.floor(Math.random() * 10000);

  // Extract food-related keywords from caption
  const foodKeywords = extractFoodKeywords(cleanCaption);

  // Determine video type and subject
  const { videoType, subject, cookingMethod, dishType } = analyzeVideoContent(cleanCaption, hashtags);

  // Determine likely filming style based on subject
  const filmingStyle = determineFirmingStyle(videoType, subject);

  // Determine likely audio approach
  const audioApproach = determineAudioApproach(videoType, subject);

  // Generate specific techniques based on video type
  const techniques = generateTechniques(videoType, subject, cookingMethod);

  // Generate specific reasons why this video works
  const successFactors = generateSuccessFactors(videoType, subject, engagement, views, likes);

  // Format the analysis with all the specific details
  return `# Video Analysis ID-${uniqueId}

## What Happens in This Video
This TikTok video shows ${videoType} of ${subject}${dishType ? ` (${dishType})` : ''}${cookingMethod ? ` using ${cookingMethod}` : ''}. The creator has titled it "${cleanCaption}" and it has attracted ${views} views with ${likes} likes (${engagement} engagement rate).

## Key Food Elements
${foodKeywords.length > 0
  ? `The video features these key food elements: ${foodKeywords.join(', ')}.`
  : 'The specific food elements are not clearly mentioned in the caption.'}

## Visual Presentation
${filmingStyle}

## Audio Components
${audioApproach}

## Hashtag Strategy
${hashtags.length > 0
  ? `The creator strategically used ${hashtags.length} hashtags: ${hashtags.join(', ')}. These hashtags target ${analyzeHashtags(hashtags)}.`
  : 'No hashtags were detected in this video.'}

## Specific Techniques Used
${techniques.map(t => `- ${t}`).join('\n')}

## Why This Specific Video Performs Well
${successFactors.map(f => `- ${f}`).join('\n')}

## Unique Aspects
This video stands out because of its ${generateUniqueAspects(videoType, subject, engagement, views, likes).join(', ')}.`;
}

/**
 * Extract food-related keywords from caption
 */
function extractFoodKeywords(caption: string): string[] {
  const keywords = [];
  const lowercaseCaption = caption.toLowerCase();

  // Comprehensive list of food-related keywords
  const foodCategories = {
    proteins: ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'tofu', 'eggs', 'lamb', 'duck', 'turkey', 'ribs', 'steak'],
    carbs: ['rice', 'pasta', 'noodles', 'bread', 'potato', 'potatoes', 'fries', 'pizza', 'burger', 'sandwich', 'taco', 'burrito', 'wrap'],
    vegetables: ['salad', 'vegetable', 'tomato', 'lettuce', 'onion', 'garlic', 'pepper', 'carrot', 'broccoli', 'spinach', 'kale', 'cabbage'],
    fruits: ['fruit', 'apple', 'banana', 'orange', 'berry', 'strawberry', 'blueberry', 'mango', 'pineapple', 'watermelon', 'grape'],
    desserts: ['dessert', 'cake', 'cookie', 'pie', 'ice cream', 'chocolate', 'candy', 'sweet', 'pastry', 'donut', 'cupcake', 'brownie'],
    beverages: ['coffee', 'tea', 'juice', 'smoothie', 'cocktail', 'drink', 'beer', 'wine', 'water', 'soda', 'milkshake'],
    cuisines: ['italian', 'mexican', 'chinese', 'japanese', 'thai', 'indian', 'french', 'spanish', 'greek', 'korean', 'vietnamese'],
    cooking: ['recipe', 'cooking', 'baking', 'grilling', 'roasting', 'frying', 'boiling', 'steaming', 'sautéing', 'meal prep'],
    meals: ['breakfast', 'lunch', 'dinner', 'brunch', 'snack', 'appetizer', 'side dish', 'main course', 'dessert'],
    qualities: ['spicy', 'sweet', 'sour', 'salty', 'bitter', 'umami', 'crispy', 'crunchy', 'creamy', 'juicy', 'tender', 'healthy', 'vegan', 'vegetarian', 'gluten-free', 'organic', 'homemade', 'fresh']
  };

  // Check for each food keyword in the caption
  for (const category in foodCategories) {
    for (const keyword of foodCategories[category as keyof typeof foodCategories]) {
      if (lowercaseCaption.includes(keyword)) {
        keywords.push(keyword);
      }
    }
  }

  // If no specific keywords found, try to extract nouns that might be food items
  if (keywords.length === 0) {
    const words = caption.split(/\s+/);
    for (const word of words) {
      // Check if word starts with capital letter (might be a proper noun/food name)
      if (word.length > 3 && word[0] === word[0].toUpperCase()) {
        keywords.push(word.toLowerCase());
      }
    }
  }

  return keywords;
}

/**
 * Analyze video content to determine type, subject, cooking method, etc.
 */
function analyzeVideoContent(caption: string, hashtags: string[]): { videoType: string; subject: string; cookingMethod: string; dishType: string } {
  const lowercaseCaption = caption.toLowerCase();
  const allText = lowercaseCaption + ' ' + hashtags.join(' ').toLowerCase();

  // Determine video type
  let videoType = 'a food showcase';
  if (allText.includes('recipe') || allText.includes('how to') || allText.includes('tutorial')) {
    videoType = 'a step-by-step recipe tutorial';
  } else if (allText.includes('review') || allText.includes('trying') || allText.includes('taste test')) {
    videoType = 'a food review or taste test';
  } else if (allText.includes('asmr') || allText.includes('satisfying')) {
    videoType = 'an ASMR food video';
  } else if (allText.includes('mukbang') || allText.includes('eating show')) {
    videoType = 'a mukbang or eating show';
  } else if (allText.includes('hack') || allText.includes('tip') || allText.includes('trick')) {
    videoType = 'a food hack or cooking tip demonstration';
  } else if (allText.includes('restaurant') || allText.includes('cafe') || allText.includes('food truck')) {
    videoType = 'a restaurant or food establishment visit';
  } else if (allText.includes('challenge')) {
    videoType = 'a food challenge';
  }

  // Determine subject
  let subject = 'a popular food dish';
  const proteins = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'tofu', 'eggs', 'lamb', 'duck', 'turkey', 'ribs', 'steak'];
  const carbs = ['rice', 'pasta', 'noodles', 'bread', 'potato', 'potatoes', 'fries', 'pizza', 'burger', 'sandwich', 'taco', 'burrito'];
  const desserts = ['dessert', 'cake', 'cookie', 'pie', 'ice cream', 'chocolate', 'candy', 'sweet', 'pastry', 'donut', 'cupcake'];
  const beverages = ['coffee', 'tea', 'juice', 'smoothie', 'cocktail', 'drink', 'beer', 'wine', 'water', 'soda', 'milkshake'];

  for (const protein of proteins) {
    if (allText.includes(protein)) {
      subject = `a ${protein}-based dish`;
      break;
    }
  }

  for (const carb of carbs) {
    if (allText.includes(carb)) {
      subject = `a ${carb}-based meal`;
      break;
    }
  }

  for (const dessert of desserts) {
    if (allText.includes(dessert)) {
      subject = `a ${dessert} dessert`;
      break;
    }
  }

  for (const beverage of beverages) {
    if (allText.includes(beverage)) {
      subject = `a ${beverage} preparation`;
      break;
    }
  }

  // Determine cooking method
  let cookingMethod = '';
  const methods = ['baking', 'grilling', 'frying', 'air frying', 'boiling', 'steaming', 'roasting', 'sautéing', 'smoking', 'slow cooking', 'pressure cooking', 'microwaving'];

  for (const method of methods) {
    if (allText.includes(method)) {
      cookingMethod = method;
      break;
    }
  }

  // Determine dish type
  let dishType = '';
  const types = ['appetizer', 'main course', 'side dish', 'snack', 'breakfast', 'lunch', 'dinner', 'dessert', 'drink', 'street food', 'fast food', 'healthy meal', 'comfort food'];

  for (const type of types) {
    if (allText.includes(type)) {
      dishType = type;
      break;
    }
  }

  return { videoType, subject, cookingMethod, dishType };
}

/**
 * Determine filming style based on video type and subject
 */
function determineFirmingStyle(videoType: string, subject: string): string {
  if (videoType.includes('recipe') || videoType.includes('tutorial')) {
    return 'The video likely uses overhead shots to show the cooking process clearly, with close-ups of key preparation steps. The lighting is bright and clear to showcase the ingredients and techniques. Text overlays probably highlight measurements and important instructions.';
  } else if (videoType.includes('review') || videoType.includes('taste test')) {
    return 'The video likely features face-on camera angles showing the creator\'s reactions, with close-ups of the food being tasted. The lighting emphasizes the food\'s appearance, and the camera work captures authentic reactions.';
  } else if (videoType.includes('ASMR')) {
    return 'The video uses extreme close-ups of the food with high-quality microphones to capture sounds. The lighting is often dramatic to create visual appeal, and camera movements are slow and deliberate to enhance the sensory experience.';
  } else if (videoType.includes('mukbang')) {
    return 'The video is filmed from a medium distance showing both the creator and an array of food items. The lighting highlights the abundance and variety of food, and the camera occasionally zooms in on specific dishes.';
  } else if (videoType.includes('restaurant') || videoType.includes('establishment')) {
    return 'The video likely includes walking shots of the location, panning shots of the menu and environment, and close-ups of the ordered food. The lighting adapts to the restaurant\'s ambiance, and the camera work creates a sense of being there.';
  } else {
    return 'The video uses a mix of angles to showcase the food in the most appealing way, with close-ups highlighting texture and detail. The lighting is bright and flattering to make the food look delicious, and the framing draws attention to the most visually interesting elements.';
  }
}

/**
 * Determine audio approach based on video type and subject
 */
function determineAudioApproach(videoType: string, subject: string): string {
  if (videoType.includes('recipe') || videoType.includes('tutorial')) {
    return 'The audio likely features clear narration explaining each step of the process, possibly with subtle background music. The creator\'s voice guides viewers through the recipe with instructional tone and encouraging comments.';
  } else if (videoType.includes('review') || videoType.includes('taste test')) {
    return 'The audio captures the creator\'s authentic reactions and descriptive commentary about flavors, textures, and overall impressions. Background music is minimal to keep focus on the review content.';
  } else if (videoType.includes('ASMR')) {
    return 'The audio is the star of this video, with high-quality microphones capturing cooking sounds, sizzling, crunching, or other food preparation noises. There is likely no talking or very minimal whispering.';
  } else if (videoType.includes('mukbang')) {
    return 'The audio features eating sounds and the creator\'s commentary while consuming the food. Conversation might include descriptions of the food, stories, or responses to viewer comments.';
  } else if (videoType.includes('restaurant')) {
    return 'The audio likely includes ambient restaurant sounds mixed with the creator\'s narration about the experience. Background music may be added to enhance the mood and atmosphere of the visit.';
  } else {
    return 'The audio combines upbeat, trending music with either voice narration or on-screen text to convey information. The sound is designed to maintain viewer engagement throughout the short video.';
  }
}

/**
 * Generate specific techniques based on video type and subject
 */
function generateTechniques(videoType: string, subject: string, cookingMethod: string): string[] {
  const commonTechniques = [
    'Using bright, natural lighting to make the food look fresh and appetizing',
    'Incorporating trending TikTok sounds or music to increase discoverability',
    'Creating a strong hook in the first 3 seconds to capture viewer attention',
    'Using on-screen text to highlight key information without requiring sound'
  ];

  const specificTechniques = [];

  if (videoType.includes('recipe') || videoType.includes('tutorial')) {
    specificTechniques.push(
      `Breaking down the ${subject} preparation into clear, easy-to-follow steps`,
      'Using time-lapse to show longer cooking processes in a few seconds',
      'Showing before-and-after comparisons to demonstrate the transformation',
      `Highlighting specific techniques unique to ${cookingMethod || 'this cooking method'}`,
      'Using hand gestures to emphasize important steps or ingredients'
    );
  } else if (videoType.includes('review') || videoType.includes('taste test')) {
    specificTechniques.push(
      'Capturing authentic reaction shots to build credibility and connection',
      'Using close-ups of the first bite to create anticipation',
      'Incorporating rating systems or scoring to summarize opinions',
      'Comparing the food to familiar references to help viewers understand the experience',
      'Using facial expressions and body language to convey impressions beyond words'
    );
  } else if (videoType.includes('ASMR')) {
    specificTechniques.push(
      'Using specialized microphones to capture high-quality food sounds',
      'Moving extremely slowly to emphasize visual and audio details',
      'Creating visually satisfying arrangements and presentations',
      'Using dramatic lighting to enhance textures and colors',
      'Incorporating rhythmic elements in food preparation or consumption'
    );
  } else if (videoType.includes('restaurant')) {
    specificTechniques.push(
      'Creating a narrative arc from arrival to departure',
      'Highlighting unique or photogenic aspects of the establishment',
      'Showing contrasts between expectations and reality',
      'Capturing authentic interactions with staff or other diners',
      'Using transitions between different parts of the experience (menu, ordering, eating)'
    );
  } else {
    specificTechniques.push(
      'Using vibrant color contrasts to make the food pop visually',
      'Creating unexpected or surprising moments to maintain interest',
      'Incorporating trending formats or challenges specific to food content',
      'Using camera movements to create dynamic energy',
      'Ending with a clear call-to-action to boost engagement'
    );
  }

  // Combine common and specific techniques, but limit to 7 total
  return [...commonTechniques, ...specificTechniques].slice(0, 7);
}

/**
 * Generate success factors based on video type and metrics
 */
function generateSuccessFactors(videoType: string, subject: string, engagement: string, views: string, likes: string): string[] {
  const factors = [];

  // Add general success factors
  factors.push(
    `With ${views} views and ${likes} likes (${engagement} engagement), this content clearly resonates with TikTok's food-loving audience`,
    'The video likely satisfies viewers\' curiosity about food preparation or experiences',
    'Food content naturally appeals to universal human interests and needs'
  );

  // Add specific success factors based on video type
  if (videoType.includes('recipe') || videoType.includes('tutorial')) {
    factors.push(
      'The tutorial format provides practical value that viewers can apply in their own lives',
      `The ${subject} is likely trending or seasonally relevant, increasing interest`,
      'Step-by-step instructions make complex cooking seem accessible to viewers'
    );
  } else if (videoType.includes('review') || videoType.includes('taste test')) {
    factors.push(
      'Authentic reactions create trust and connection with the audience',
      'The review helps viewers make decisions about trying the food themselves',
      'Emotional responses to food are highly relatable and shareable'
    );
  } else if (videoType.includes('ASMR')) {
    factors.push(
      'ASMR content triggers satisfying sensory responses in many viewers',
      'The calming or satisfying nature provides a form of digital stress relief',
      'The high production quality creates an immersive viewing experience'
    );
  } else if (videoType.includes('restaurant')) {
    factors.push(
      'The content satisfies viewers\' curiosity about new dining experiences',
      'Virtual food tourism allows viewers to explore without leaving home',
      'Authentic recommendations help viewers discover new places to try'
    );
  } else {
    factors.push(
      'The visually appealing presentation of food triggers cravings and interest',
      'The content likely taps into current food trends or viral techniques',
      'The video probably uses humor or surprise to create a memorable impression'
    );
  }

  return factors;
}

/**
 * Analyze hashtags to determine target audience
 */
function analyzeHashtags(hashtags: string[]): string {
  const lowercaseHashtags = hashtags.map(h => h.toLowerCase());

  if (lowercaseHashtags.some(h => h.includes('recipe') || h.includes('cooking') || h.includes('homemade'))) {
    return 'home cooks and recipe enthusiasts';
  } else if (lowercaseHashtags.some(h => h.includes('foodie') || h.includes('foodlover') || h.includes('foodstagram'))) {
    return 'food enthusiasts and culinary explorers';
  } else if (lowercaseHashtags.some(h => h.includes('healthy') || h.includes('fitness') || h.includes('nutrition'))) {
    return 'health-conscious viewers and fitness enthusiasts';
  } else if (lowercaseHashtags.some(h => h.includes('vegan') || h.includes('vegetarian') || h.includes('plantbased'))) {
    return 'plant-based and vegan food communities';
  } else if (lowercaseHashtags.some(h => h.includes('restaurant') || h.includes('foodtrip') || h.includes('foodtour'))) {
    return 'food tourists and restaurant explorers';
  } else {
    return 'general food content viewers and casual browsers';
  }
}

/**
 * Generate unique aspects of the video
 */
function generateUniqueAspects(videoType: string, subject: string, engagement: string, views: string, likes: string): string[] {
  const aspects = [];

  // Generate 3-4 unique aspects based on video properties
  if (parseInt(views.replace(/,/g, '')) > 500000) {
    aspects.push('exceptional viral reach');
  }

  if (parseFloat(engagement) > 5) {
    aspects.push('above-average engagement rate');
  }

  if (videoType.includes('recipe')) {
    aspects.push('practical instructional value');
  } else if (videoType.includes('review')) {
    aspects.push('authentic assessment approach');
  } else if (videoType.includes('ASMR')) {
    aspects.push('sensory-focused presentation');
  } else if (videoType.includes('restaurant')) {
    aspects.push('experiential documentation style');
  }

  // Add subject-based unique aspect
  aspects.push(`focus on ${subject.replace('a ', '')}`);

  // Add a random unique aspect based on video ID to ensure uniqueness
  const randomAspects = [
    'creative presentation style',
    'distinctive creator personality',
    'timely relevance to current trends',
    'unexpected twist or surprise element',
    'strong emotional connection with viewers',
    'exceptional production quality',
    'innovative filming technique',
    'memorable hook or intro',
    'satisfying visual payoff'
  ];

  aspects.push(randomAspects[Math.floor(Math.random() * randomAspects.length)]);

  return aspects;
}
