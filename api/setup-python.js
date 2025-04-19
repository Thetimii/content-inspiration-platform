const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Function to execute shell commands
function runCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      
      if (error) {
        console.error(`Command failed: ${error.message}`);
        return reject(error);
      }
      resolve(stdout);
    });
  });
}

// The main function that will run during build or on first invocation
async function setupPython() {
  console.log('Setting up Python environment...');
  
  try {
    // Create directories for installation
    const cacheDir = path.join('/tmp', '.vercel', 'cache');
    const pythonDir = path.join(cacheDir, 'python');
    const binDir = path.join(pythonDir, 'bin');
    
    await fs.promises.mkdir(binDir, { recursive: true });
    
    // Check if Python is already available
    try {
      await runCommand('python3 --version');
      console.log('Python is already available');
    } catch (error) {
      console.log('Installing Python...');
      try {
        // On Linux (Vercel) we can try to use apt-get if available
        await runCommand('apt-get update && apt-get install -y python3 python3-pip');
      } catch (aptError) {
        console.log('apt-get failed, trying to download portable Python...');
        
        // Try to download a portable Python version
        await runCommand(`
          curl -L https://github.com/indygreg/python-build-standalone/releases/download/20240107/cpython-3.11.7+20240107-x86_64-unknown-linux-gnu-install_only.tar.gz -o /tmp/python.tar.gz &&
          tar -xzf /tmp/python.tar.gz -C ${pythonDir} &&
          ln -s ${pythonDir}/python/bin/python3 ${binDir}/python3 &&
          ln -s ${pythonDir}/python/bin/pip3 ${binDir}/pip3
        `);
        
        // Update PATH
        process.env.PATH = `${binDir}:${process.env.PATH}`;
      }
    }
    
    // Check if video-analyzer is installed
    try {
      await runCommand('which video-analyzer');
      console.log('video-analyzer is already installed');
    } catch (error) {
      console.log('Installing video-analyzer...');
      await runCommand('pip3 install git+https://github.com/byjlw/video-analyzer.git');
      
      // Symlink to standard locations
      await runCommand(`ln -sf $(which video-analyzer) ${binDir}/video-analyzer`);
    }
    
    return { success: true, message: 'Python environment ready' };
  } catch (error) {
    console.error('Failed to set up Python:', error);
    return { success: false, error: error.message };
  }
}

// Run setup when this endpoint is called directly
module.exports = async (req, res) => {
  try {
    const result = await setupPython();
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Setup failed'
    });
  }
};

// Also try to run during build
if (process.env.VERCEL_ENV) {
  setupPython().catch(error => {
    console.error('Python setup failed during build:', error);
  });
} 