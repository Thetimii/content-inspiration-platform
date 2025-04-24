import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to check the status of various APIs
 * This is designed to be called by a cron job
 */
export async function GET(request: Request) {
  try {
    // Check OpenRouter API status
    await checkOpenRouterStatus();
    
    // Check RapidAPI status
    await checkRapidAPIStatus();
    
    // Check Brevo API status
    await checkBrevoStatus();
    
    return NextResponse.json({
      status: 'success',
      message: 'API status checks completed successfully'
    });
  } catch (error: any) {
    console.error('Error checking API status:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to check API status',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Check the status of the OpenRouter API
 */
async function checkOpenRouterStatus() {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      await updateApiStatus('openrouter', 'error', {
        message: 'API key is not configured',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Sanitize the API key
    const sanitizedApiKey = apiKey.trim();
    
    // Check for common issues
    const apiKeyAnalysis = {
      originalLength: apiKey.length,
      sanitizedLength: sanitizedApiKey.length,
      hasSpaces: apiKey.includes(' '),
      hasNewlines: apiKey.includes('\n') || apiKey.includes('\r'),
      hasInvalidChars: /[^\x20-\x7E]/.test(apiKey),
      firstFiveChars: sanitizedApiKey.substring(0, 5),
      lastFiveChars: sanitizedApiKey.substring(sanitizedApiKey.length - 5)
    };
    
    // If there are issues with the API key, update the status
    if (apiKeyAnalysis.hasSpaces || apiKeyAnalysis.hasNewlines || apiKeyAnalysis.hasInvalidChars) {
      await updateApiStatus('openrouter', 'error', {
        message: 'API key contains invalid characters',
        analysis: apiKeyAnalysis,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Make a test request to OpenRouter
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'google/gemma-3-4b-it:free',
          messages: [
            {
              role: 'user',
              content: 'Hello, this is a test message to verify the API key is working.'
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${sanitizedApiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
            'X-Title': 'Lazy Trends API Key Test',
            'Content-Type': 'application/json'
          }
        }
      );
      
      // If we get here, the API key is valid
      await updateApiStatus('openrouter', 'ok', {
        message: 'API key is valid',
        model: response.data.model,
        responseStatus: response.status,
        analysis: apiKeyAnalysis,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      // If we get an error, the API key is invalid
      await updateApiStatus('openrouter', 'error', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data',
        analysis: apiKeyAnalysis,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error('Error checking OpenRouter status:', error);
    await updateApiStatus('openrouter', 'error', {
      message: 'Error checking API status: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Check the status of the RapidAPI
 */
async function checkRapidAPIStatus() {
  try {
    const apiKey = process.env.RAPIDAPI_KEY;
    
    if (!apiKey) {
      await updateApiStatus('rapidapi', 'error', {
        message: 'API key is not configured',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Make a test request to RapidAPI
    try {
      const response = await axios.get(
        'https://tiktok-download-video1.p.rapidapi.com/feedSearch',
        {
          params: {
            keywords: 'test',
            count: '1',
            cursor: '0',
            region: 'US',
            publish_time: '0',
            sort_type: '0'
          },
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'tiktok-download-video1.p.rapidapi.com'
          }
        }
      );
      
      // If we get here, the API key is valid
      await updateApiStatus('rapidapi', 'ok', {
        message: 'API key is valid',
        responseStatus: response.status,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      // If we get an error, the API key is invalid
      await updateApiStatus('rapidapi', 'error', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error('Error checking RapidAPI status:', error);
    await updateApiStatus('rapidapi', 'error', {
      message: 'Error checking API status: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Check the status of the Brevo API
 */
async function checkBrevoStatus() {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    
    if (!apiKey) {
      await updateApiStatus('brevo', 'error', {
        message: 'API key is not configured',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Make a test request to Brevo
    try {
      const response = await axios.get(
        'https://api.brevo.com/v3/account',
        {
          headers: {
            'api-key': apiKey,
            'Accept': 'application/json'
          }
        }
      );
      
      // If we get here, the API key is valid
      await updateApiStatus('brevo', 'ok', {
        message: 'API key is valid',
        responseStatus: response.status,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      // If we get an error, the API key is invalid
      await updateApiStatus('brevo', 'error', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error('Error checking Brevo status:', error);
    await updateApiStatus('brevo', 'error', {
      message: 'Error checking API status: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Update the API status in the database
 */
async function updateApiStatus(serviceName: string, status: string, details: any) {
  try {
    // Check if the service already exists
    const { data: existingData, error: existingError } = await supabase
      .from('api_status')
      .select('id')
      .eq('service_name', serviceName)
      .single();
    
    if (existingError && existingError.code !== 'PGRST116') {
      console.error(`Error checking if ${serviceName} exists:`, existingError);
      return;
    }
    
    if (existingData) {
      // Update the existing record
      const { error } = await supabase
        .from('api_status')
        .update({
          status,
          details,
          last_checked: new Date().toISOString()
        })
        .eq('service_name', serviceName);
      
      if (error) {
        console.error(`Error updating ${serviceName} status:`, error);
      }
    } else {
      // Insert a new record
      const { error } = await supabase
        .from('api_status')
        .insert({
          service_name: serviceName,
          status,
          details,
          last_checked: new Date().toISOString()
        });
      
      if (error) {
        console.error(`Error inserting ${serviceName} status:`, error);
      }
    }
  } catch (error) {
    console.error(`Error updating ${serviceName} status:`, error);
  }
}
