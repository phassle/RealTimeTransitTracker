#!/usr/bin/env node

/**
 * Downloads GTFS Static data and builds a mapping from trip_id to route info
 *
 * Usage:
 *   1. Add GTFS_REGIONAL_API_KEY to .env
 *   2. Run: node scripts/build-trip-mapping.js
 */

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';
import AdmZip from 'adm-zip';
import csvParser from 'csv-parser';
import fetch from 'node-fetch';

const GTFS_REGIONAL_URL = 'https://opendata.samtrafiken.se/gtfs/sl/sl.zip';
const OUTPUT_DIR = './public/data';
const TEMP_DIR = './tmp';

async function downloadGTFS(apiKey) {
  console.log('📥 Downloading GTFS Static data from Trafiklab...');

  const url = `${GTFS_REGIONAL_URL}?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept-Encoding': 'gzip' }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to download: ${response.status} - ${text}`);
    }

    // Create temp directory
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const zipPath = path.join(TEMP_DIR, 'sl.zip');

    // Download and save
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(zipPath, buffer);

    console.log(`✅ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    return zipPath;

  } catch (error) {
    console.error('❌ Download failed:', error.message);
    throw error;
  }
}

async function extractGTFS(zipPath) {
  console.log('📦 Extracting GTFS files...');

  const zip = new AdmZip(zipPath);
  const extractPath = path.join(TEMP_DIR, 'gtfs');

  zip.extractAllTo(extractPath, true);

  console.log('✅ Extracted GTFS files');
  return extractPath;
}

async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];

    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function buildTripMapping(gtfsPath) {
  console.log('🔨 Building trip_id → route mapping...');

  // Parse routes.txt
  const routesPath = path.join(gtfsPath, 'routes.txt');
  const routes = await parseCSV(routesPath);

  console.log(`   Found ${routes.length} routes`);

  // Build route map: route_id → route info
  const routeMap = new Map();
  routes.forEach(route => {
    routeMap.set(route.route_id, {
      id: route.route_id,
      shortName: route.route_short_name,
      longName: route.route_long_name,
      type: route.route_type
    });
  });

  // Parse trips.txt
  const tripsPath = path.join(gtfsPath, 'trips.txt');
  const trips = await parseCSV(tripsPath);

  console.log(`   Found ${trips.length} trips`);

  // Build trip map: trip_id → route info
  const tripMapping = {};
  let mappedCount = 0;

  trips.forEach(trip => {
    const route = routeMap.get(trip.route_id);
    if (route) {
      tripMapping[trip.trip_id] = {
        routeId: route.id,
        line: route.shortName || route.longName || trip.route_id,
        routeType: route.type
      };
      mappedCount++;
    }
  });

  console.log(`✅ Mapped ${mappedCount} trips to routes`);

  return tripMapping;
}

async function saveTripMapping(mapping) {
  console.log('💾 Saving trip mapping...');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, 'trip-mapping.json');

  fs.writeFileSync(
    outputPath,
    JSON.stringify(mapping, null, 2)
  );

  const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(2);
  console.log(`✅ Saved to ${outputPath} (${sizeKB} KB)`);

  return outputPath;
}

function cleanup() {
  console.log('🧹 Cleaning up temporary files...');

  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }

  console.log('✅ Cleanup complete');
}

async function main() {
  console.log('🚀 GTFS Trip Mapping Builder\n');

  // Check for API key
  const apiKey = process.env.GTFS_REGIONAL_API_KEY || process.env.VITE_TRAFIKLAB_API_KEY;

  if (!apiKey) {
    console.error('❌ Error: GTFS_REGIONAL_API_KEY not found in environment');
    console.error('\nPlease add to .env:');
    console.error('GTFS_REGIONAL_API_KEY=your_api_key_here\n');
    process.exit(1);
  }

  try {
    // Download GTFS data
    const zipPath = await downloadGTFS(apiKey);

    // Extract files
    const gtfsPath = await extractGTFS(zipPath);

    // Build mapping
    const mapping = await buildTripMapping(gtfsPath);

    // Save to file
    await saveTripMapping(mapping);

    // Cleanup
    cleanup();

    console.log('\n✨ Trip mapping build complete!');
    console.log('   Update your app to load: /data/trip-mapping.json\n');

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    cleanup();
    process.exit(1);
  }
}

main();
