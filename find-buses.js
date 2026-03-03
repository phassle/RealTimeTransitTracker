#!/usr/bin/env node

import 'dotenv/config';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import fetch from 'node-fetch';

const API_KEY = process.env.VITE_TRAFIKLAB_API_KEY;
const API_URL = `https://opendata.samtrafiken.se/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=${API_KEY}`;

async function findBuses() {
  console.log('🔍 Looking for ANY buses in GTFS-RT feed...\n');

  try {
    // Fetch SL lines to get bus GIDs
    const linesResponse = await fetch('https://transport.integration.sl.se/v1/lines?transport_authority_id=1');
    const linesData = await linesResponse.json();

    const busGids = new Set(linesData.bus.map(bus => bus.gid.toString()));
    console.log(`📋 Total bus lines in SL: ${busGids.size}`);
    console.log(`📋 Sample bus GIDs: ${[...busGids].slice(0, 10).join(', ')}\n`);

    // Fetch GTFS-RT
    const response = await fetch(API_URL, {
      headers: { 'Accept-Encoding': 'gzip' }
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    console.log(`📊 Total vehicles in GTFS-RT: ${feed.entity.length}`);

    // Filter for buses
    const buses = feed.entity
      .filter(entity => entity.vehicle && entity.vehicle.position)
      .filter(entity => {
        const routeId = entity.vehicle.trip?.routeId;
        return routeId && busGids.has(routeId);
      });

    console.log(`🚌 Buses with positions: ${buses.length}\n`);

    if (buses.length > 0) {
      console.log('✅ Found buses! Showing first 5:\n');
      buses.slice(0, 5).forEach((entity, i) => {
        const v = entity.vehicle;
        const busLine = linesData.bus.find(b => b.gid.toString() === v.trip?.routeId);
        console.log(`${i + 1}. Line ${busLine?.designation || 'Unknown'}: ${v.vehicle?.id} @ (${v.position.latitude}, ${v.position.longitude})`);
      });

      // Show distribution by line
      const byLine = {};
      buses.forEach(entity => {
        const routeId = entity.vehicle.trip?.routeId;
        const busLine = linesData.bus.find(b => b.gid.toString() === routeId);
        const designation = busLine?.designation || routeId;
        byLine[designation] = (byLine[designation] || 0) + 1;
      });

      console.log('\n📊 Top 20 active bus lines:');
      Object.entries(byLine)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([line, count]) => {
          console.log(`  Line ${line.padEnd(5)}: ${count.toString().padStart(3)} buses`);
        });
    } else {
      console.log('❌ No buses found in GTFS-RT feed');
      console.log('💡 This might mean:');
      console.log('   - Buses are not included in this feed');
      console.log('   - Different feed needed for buses');
      console.log('   - All metro/trains instead');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findBuses();
