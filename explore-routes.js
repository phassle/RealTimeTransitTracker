#!/usr/bin/env node

import 'dotenv/config';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import fetch from 'node-fetch';
import { promisify } from 'util';

const API_KEY = process.env.VITE_TRAFIKLAB_API_KEY;
const API_URL = `https://opendata.samtrafiken.se/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=${API_KEY}`;

async function exploreRoutes() {
  console.log('🔍 Exploring GTFS-RT data structure...\n');

  try {
    const response = await fetch(API_URL, {
      headers: { 'Accept-Encoding': 'gzip' }
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    console.log(`📊 Total vehicles: ${feed.entity.length}\n`);

    // Show first 10 vehicles with full details
    console.log('📋 Sample vehicle data (first 10 with positions):\n');

    const samples = feed.entity
      .filter(entity => entity.vehicle && entity.vehicle.position)
      .slice(0, 10);

    samples.forEach((entity, index) => {
      const v = entity.vehicle;
      console.log(`--- Vehicle ${index + 1} ---`);
      console.log(`  ID: ${entity.id}`);
      console.log(`  Vehicle ID: ${v.vehicle?.id}`);
      console.log(`  Vehicle Label: ${v.vehicle?.label || 'N/A'}`);
      console.log(`  License Plate: ${v.vehicle?.licensePlate || 'N/A'}`);
      console.log(`  Route ID: ${v.trip?.routeId || 'N/A'}`);
      console.log(`  Trip ID: ${v.trip?.tripId || 'N/A'}`);
      console.log(`  Direction: ${v.trip?.directionId ?? 'N/A'}`);
      console.log(`  Start Time: ${v.trip?.startTime || 'N/A'}`);
      console.log(`  Position: (${v.position.latitude}, ${v.position.longitude})`);
      console.log(`  Bearing: ${v.position.bearing || 'N/A'}°`);
      console.log(`  Speed: ${v.position.speed ? (v.position.speed * 3.6).toFixed(1) : 'N/A'} km/h`);
      console.log(`  Current Stop: ${v.currentStopSequence || 'N/A'}`);
      console.log(`  Stop ID: ${v.stopId || 'N/A'}`);
      console.log('');
    });

    // Try to find if there's any pattern with route descriptions
    console.log('\n🔎 Looking for route descriptions or short names...\n');

    // Check if any trips have route short names or other identifiers
    const routeInfo = feed.entity
      .filter(entity => entity.vehicle && entity.vehicle.trip)
      .map(entity => ({
        routeId: entity.vehicle.trip.routeId,
        tripId: entity.vehicle.trip.tripId,
        vehicleLabel: entity.vehicle.vehicle?.label
      }))
      .slice(0, 20);

    console.log('Route ID patterns:');
    routeInfo.forEach(info => {
      console.log(`  Route: ${info.routeId}, Trip: ${info.tripId?.substring(0, 30)}..., Vehicle: ${info.vehicleLabel || 'N/A'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exploreRoutes();
