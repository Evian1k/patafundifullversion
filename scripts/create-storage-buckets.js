#!/usr/bin/env node

/**
 * DEPRECATED: This script used Supabase storage and is no longer needed.
 * 
 * The app now uses local file storage at /uploads/fundis/
 * No bucket creation is necessary.
 */

console.log("⚠️  DEPRECATED: This script uses Supabase storage and is no longer used.");
console.log("");
console.log("The app now uses local file storage at /uploads/fundis/");
console.log("No bucket configuration is needed.");
console.log("");
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   VITE_SUPABASE_PUBLISHABLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const buckets = [
  { name: 'fundi-ids', description: 'ID photos (front and back)' },
  { name: 'fundi-selfies', description: 'Selfie photos' },
  { name: 'fundi-certificates', description: 'Professional certificates' }
];

async function createBuckets() {
  console.log('🔧 Creating Supabase storage buckets...\n');

  for (const bucket of buckets) {
    try {
      console.log(`Creating bucket: ${bucket.name} (${bucket.description})`);
      
      const { data, error } = await supabase.storage.createBucket(bucket.name, {
        public: false,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });

      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ✓ Bucket "${bucket.name}" already exists`);
        } else {
          console.error(`  ✗ Error: ${error.message}`);
        }
      } else {
        console.log(`  ✓ Bucket "${bucket.name}" created successfully`);
      }
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  console.log('\n✅ Storage bucket setup complete!');
  console.log('\nNext steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Navigate to: http://localhost:8080/fundi/register');
  console.log('3. Try submitting the registration again');
}

createBuckets();
