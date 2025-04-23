const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or service role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Applying migration: ${filePath}`);
    console.log(`SQL: ${sql}`);

    const { error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      console.error('Error applying migration:', error);
      return false;
    }

    console.log(`Migration applied successfully: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error reading or applying migration ${filePath}:`, error);
    return false;
  }
}

async function main() {
  // Get the migration file path from command line arguments
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error('Please provide a migration file path');
    process.exit(1);
  }

  const filePath = path.resolve(migrationFile);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Migration file not found: ${filePath}`);
    process.exit(1);
  }

  const success = await applyMigration(filePath);
  
  if (!success) {
    console.error('Migration failed');
    process.exit(1);
  }

  console.log('Migration completed successfully');
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
