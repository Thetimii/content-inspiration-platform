/**
 * Email templates for the application
 */

/**
 * Generate HTML content for recommendation email
 */
export function getRecommendationEmailTemplate(userName: string, recommendations: any) {
  // Format the recommendations
  const formattedRecommendations = formatRecommendationsForEmail(recommendations);

  // Get current date for the email
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6366F1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .date-banner { background-color: #4F46E5; color: white; padding: 10px; text-align: center; font-size: 16px; font-weight: bold; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
          .recommendation { margin-bottom: 20px; padding: 20px; background-color: white; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .section { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
          .section-title { color: #4F46E5; font-size: 18px; margin-bottom: 10px; }
          .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #6b7280; }
          .button { display: inline-block; background-color: #6366F1; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px; font-weight: bold; }
          h1, h2, h3 { color: #4F46E5; }
          ul { padding-left: 20px; }
          li { margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Lazy Trends</h1>
          </div>
          <div class="date-banner">
            Trend Report for ${formattedDate}
          </div>
          <div class="content">
            <h2>Hello ${userName || 'there'}!</h2>
            <p>Here's your daily TikTok trend analysis to help you create engaging content that resonates with your audience:</p>

            ${formattedRecommendations}

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/dashboard" class="button">View Full Details in Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>You're receiving this email because you signed up for Lazy Trends.
            You can manage your email preferences in your <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/dashboard">dashboard</a>.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Format recommendations data for email display
 */
function formatRecommendationsForEmail(recommendations: any): string {
  if (!recommendations || !recommendations.length) {
    return '<p>No recommendations available at this time. Check back later!</p>';
  }

  // Take the most recent recommendation
  const latestRecommendation = recommendations[0];

  // Extract sections from the combined_summary using markdown headers
  let videoAnalysis = '';
  let technicalBreakdown = '';
  let contentGuide = '';
  let contentIdeas = '';

  if (latestRecommendation.combined_summary) {
    const fullContent = latestRecommendation.combined_summary;

    // Extract sections using regex
    const videoAnalysisMatch = fullContent.match(/## 📊 Video Analysis([\s\S]*?)(?=## 🎬|## 📝|## 💡|$)/);
    const technicalMatch = fullContent.match(/## 🎬 Technical Breakdown([\s\S]*?)(?=## 📊|## 📝|## 💡|$)/);
    const guideMatch = fullContent.match(/## 📝 Content Creation Guide([\s\S]*?)(?=## 📊|## 🎬|## 💡|$)/);
    const ideasMatch = fullContent.match(/## 💡 5 Content Ideas([\s\S]*?)(?=$)/);

    videoAnalysis = videoAnalysisMatch ? videoAnalysisMatch[1].trim() : '';
    technicalBreakdown = technicalMatch ? technicalMatch[1].trim() : '';
    contentGuide = guideMatch ? guideMatch[1].trim() : '';
    contentIdeas = ideasMatch ? ideasMatch[1].trim() : '';
  }

  // Convert markdown to simple HTML
  const convertMarkdownToHTML = (markdown: string) => {
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/^- (.*?)$/gm, '<li>$1</li>') // List items
      .replace(/<\/li>\s*<li>/g, '</li><li>') // Clean up list items
      .replace(/(?:<li>.*?<\/li>)/gs, '<ul>$&</ul>') // Wrap list items in ul
      .replace(/<ul><ul>/g, '<ul>') // Fix nested lists
      .replace(/<\/ul><\/ul>/g, '</ul>') // Fix nested lists
      .replace(/^\d+\. (.*?)$/gm, '<li>$1</li>') // Numbered list items
      .replace(/(?:<li>.*?<\/li>)/gs, match => {
        return match.includes('1. ') ? `<ol>${match}</ol>` : match;
      }) // Wrap numbered list items in ol
      .replace(/\n\n/g, '<br><br>') // Double line breaks
      .replace(/\n/g, '<br>'); // Single line breaks
  };

  let html = `<div class="recommendation">`;

  // Video Analysis Section
  if (videoAnalysis) {
    html += `
      <div class="section">
        <h3 class="section-title">📊 Video Analysis</h3>
        <div>${convertMarkdownToHTML(videoAnalysis)}</div>
      </div>
    `;
  }

  // Technical Breakdown Section
  if (technicalBreakdown) {
    html += `
      <div class="section">
        <h3 class="section-title">🎬 Technical Breakdown</h3>
        <div>${convertMarkdownToHTML(technicalBreakdown)}</div>
      </div>
    `;
  }

  // Content Guide Section
  if (contentGuide) {
    html += `
      <div class="section">
        <h3 class="section-title">📝 Content Creation Guide</h3>
        <div>${convertMarkdownToHTML(contentGuide)}</div>
      </div>
    `;
  }

  // Content Ideas Section
  if (contentIdeas) {
    html += `
      <div class="section">
        <h3 class="section-title">💡 Content Ideas</h3>
        <div>${convertMarkdownToHTML(contentIdeas)}</div>
      </div>
    `;
  }

  html += '</div>';
  return html;
}
