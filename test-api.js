#!/usr/bin/env node

import 'dotenv/config';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import fetch from 'node-fetch';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

const API_KEY = process.env.VITE_TRAFIKLAB_API_KEY;
const API_URL = `https://opendata.samtrafiken.se/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=${API_KEY}`;

async function fetchVehiclePositions() {
  console.log('🚌 Fetching vehicle positions from Trafiklab...\n');

  try {
    const response = await fetch(API_URL, {
      headers: {
        'Accept-Encoding': 'gzip'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    console.log(`✅ HTTP ${response.status} - Downloading data...`);

    // Get the buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`📦 Downloaded: ${(buffer.length / 1024).toFixed(1)} KB`);

    // Try to decompress if gzipped, otherwise use directly
    let data;
    try {
      data = await gunzip(buffer);
      console.log(`📦 Decompressed: ${(data.length / 1024).toFixed(1)} KB\n`);
    } catch (e) {
      console.log(`📦 Not gzipped, using raw data\n`);
      data = buffer;
    }

    // Parse GTFS-RT protobuf
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(data)
    );

    const timestamp = new Date(feed.header.timestamp * 1000);
    console.log(`⏰ Feed timestamp: ${timestamp.toLocaleString('sv-SE')}`);
    console.log(`📊 Total entities: ${feed.entity.length}\n`);

    // Get all unique route IDs
    const allRoutes = [...new Set(
      feed.entity
        .filter(entity => entity.vehicle && entity.vehicle.trip?.routeId)
        .map(entity => entity.vehicle.trip.routeId)
    )].sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    console.log(`🚍 Found ${allRoutes.length} unique routes`);
    console.log(`📋 Bus routes (numeric only, first 50): ${allRoutes.filter(r => /^\d+$/.test(r)).slice(0, 50).join(', ')}\n`);

    // Filter for bus lines 1, 2, 3, 4 using their GID (from SL Transport API)
    const busLineMapping = {
      '9011001000100000': '1',
      '9011001000200000': '2',
      '9011001000300000': '3',
      '9011001000400000': '4'
    };
    const targetRouteIds = Object.keys(busLineMapping);

    const buses = feed.entity
      .filter(entity => entity.vehicle && entity.vehicle.position)
      .filter(entity => {
        const routeId = entity.vehicle.trip?.routeId;
        return routeId && targetRouteIds.includes(routeId);
      })
      .map(entity => {
        const routeId = entity.vehicle.trip?.routeId;
        return {
          id: entity.vehicle.vehicle?.id || entity.id,
          routeId: routeId,
          line: busLineMapping[routeId] || routeId, // Convert GID to line number
          label: entity.vehicle.vehicle?.label,
          latitude: entity.vehicle.position.latitude,
          longitude: entity.vehicle.position.longitude,
          bearing: entity.vehicle.position.bearing || 0,
          speed: entity.vehicle.position.speed ? (entity.vehicle.position.speed * 3.6).toFixed(1) : 'N/A',
          timestamp: entity.vehicle.timestamp ? new Date(entity.vehicle.timestamp * 1000) : timestamp
        };
      });

    console.log(`🎯 Buses on lines 1, 2, 3, 4: ${buses.length}\n`);

    // Group by line number
    const targetLineNumbers = ['1', '2', '3', '4'];
    const byLine = targetLineNumbers.reduce((acc, line) => {
      acc[line] = buses.filter(b => b.line === line);
      return acc;
    }, {});

    // Show statistics
    console.log('📈 Distribution:');
    targetLineNumbers.forEach(line => {
      const count = byLine[line].length;
      const bar = '█'.repeat(Math.ceil(count / 2));
      console.log(`  Line ${line}: ${count.toString().padStart(3)} buses ${bar}`);
    });

    console.log('\n🗺️  Sample positions:');
    targetLineNumbers.forEach(line => {
      const sample = byLine[line][0];
      if (sample) {
        console.log(`  Line ${line}: ${sample.label || sample.id} @ (${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}) - ${sample.speed} km/h`);
      } else {
        console.log(`  Line ${line}: No buses currently active`);
      }
    });

    console.log('\n✅ API test successful! Ready to build the map.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchVehiclePositions();
