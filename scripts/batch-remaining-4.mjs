/**
 * batch-remaining-4.mjs
 *
 * Generates 29 SettleGrid MCP servers using the compact auto-generator:
 *   Transportation (15): opensky, aviationstack, flightaware, transit-land, gtfs,
 *     citybikes, car-fuel, nhtsa, vin-decoder, maritime, port-data, airline-routes,
 *     train-data, ev-charging, traffic
 *   Crypto (14): coinpaprika, blockchair, blockchain-info, solscan, bscscan,
 *     polygonscan, arbiscan, avalanche, near, cosmos, cardano, algorand, tezos, defi-llama
 */

import { G, M } from './lib/generate-auto.mjs'

console.log('Generating 29 Transportation + Crypto MCP servers...\n')

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSPORTATION (15)
// ═══════════════════════════════════════════════════════════════════════════════

G('opensky', 'OpenSky Network', 'Live flight tracking and aircraft state vectors from the OpenSky Network.', 'https://opensky-network.org/api',
  {},
  { p: 'OpenSky Network', u: 'https://opensky-network.org/api', r: '100 req/day unauthenticated', docs: 'https://openskynetwork.github.io/opensky-api/' },
  ['aviation', 'flights', 'tracking', 'aircraft'],
  [
    M('get_states', 'All State Vectors', 1, 'Get current state vectors for all aircraft', [], '/states/all', { l: 'states', f: ['icao24', 'callsign', 'origin_country', 'longitude', 'latitude', 'baro_altitude', 'velocity'], m: 20 }),
    M('get_flights_by_aircraft', 'Flights by Aircraft', 1, 'Get flights for a specific aircraft by ICAO24 address', [{ s: 'icao24' }], '/flights/aircraft?icao24=${icao24}&begin=0&end=9999999999', { l: 'flights', f: ['icao24', 'firstSeen', 'lastSeen', 'estDepartureAirport', 'estArrivalAirport'], m: 10 }),
    M('get_track', 'Flight Track', 1, 'Get waypoints for a specific flight', [{ s: 'icao24' }], '/tracks/all?icao24=${icao24}&time=0', { f: ['icao24', 'callsign', 'startTime', 'endTime', 'path'] }),
  ])

G('aviationstack', 'Aviationstack', 'Real-time and historical flight data from the Aviationstack API.', 'https://api.aviationstack.com/v1',
  { q: 'access_key', e: 'AVIATIONSTACK_API_KEY', d: 'Free key from aviationstack.com' },
  { p: 'Aviationstack', u: 'https://api.aviationstack.com/v1', r: '100 req/month (free)', docs: 'https://aviationstack.com/documentation' },
  ['aviation', 'flights', 'airports', 'airlines'],
  [
    M('search_flights', 'Search Flights', 2, 'Search real-time flights by airline or route', [{ os: 'airline_iata' }, { os: 'dep_iata' }], '/flights?airline_iata=${airline_iata}&dep_iata=${dep_iata}', { l: 'data', f: ['flight_date', 'flight_status', 'departure', 'arrival', 'airline', 'flight'], m: 10 }),
    M('get_airports', 'List Airports', 2, 'Search airports by name or IATA code', [{ s: 'search' }], '/airports?search=${search}', { l: 'data', f: ['airport_name', 'iata_code', 'country_name', 'city_iata_code', 'timezone'], m: 10 }),
    M('get_airlines', 'List Airlines', 2, 'Search airlines by name', [{ s: 'search' }], '/airlines?search=${search}', { l: 'data', f: ['airline_name', 'iata_code', 'country_name', 'fleet_size'], m: 10 }),
  ])

G('flightaware', 'FlightAware AeroAPI', 'Flight tracking, status, and airport data from FlightAware AeroAPI.', 'https://aeroapi.flightaware.com/aeroapi',
  { h: 'x-apikey', e: 'FLIGHTAWARE_API_KEY', d: 'AeroAPI key from flightaware.com/aeroapi' },
  { p: 'FlightAware', u: 'https://aeroapi.flightaware.com/aeroapi', r: 'Tier-based', docs: 'https://flightaware.com/aeroapi/portal/documentation' },
  ['aviation', 'flights', 'tracking', 'airports'],
  [
    M('get_flight', 'Flight Info', 2, 'Get flight information by flight ID', [{ s: 'flight_id' }], '/flights/${flight_id}', { f: ['ident', 'operator', 'origin', 'destination', 'status', 'scheduled_out', 'actual_out'] }),
    M('get_airport_flights', 'Airport Flights', 2, 'Get flights at an airport', [{ s: 'airport_code' }], '/airports/${airport_code}/flights', { l: 'arrivals', f: ['ident', 'origin', 'destination', 'status'], m: 10 }),
  ])

G('transit-land', 'Transitland', 'Public transit data — routes, stops, and operators worldwide.', 'https://transit.land/api/v2',
  {},
  { p: 'Transitland', u: 'https://transit.land/api/v2', r: 'Reasonable use', docs: 'https://www.transit.land/documentation' },
  ['transit', 'public-transport', 'bus', 'subway', 'routes'],
  [
    M('search_operators', 'Search Operators', 1, 'Search transit operators by name', [{ s: 'name' }], '/rest/operators?search=${name}', { l: 'operators', f: ['onestop_id', 'name', 'short_name', 'website'], m: 10 }),
    M('search_stops', 'Search Stops', 1, 'Search transit stops by name', [{ s: 'name' }], '/rest/stops?search=${name}', { l: 'stops', f: ['onestop_id', 'stop_name', 'geometry'], m: 10 }),
    M('search_routes', 'Search Routes', 1, 'Search transit routes by name or operator', [{ s: 'name' }], '/rest/routes?search=${name}', { l: 'routes', f: ['onestop_id', 'route_short_name', 'route_long_name', 'route_type'], m: 10 }),
  ])

G('gtfs', 'TransitFeeds GTFS', 'GTFS transit feed listings and metadata from TransitFeeds.', 'https://api.transitfeeds.com/v1',
  { q: 'key', e: 'TRANSITFEEDS_API_KEY', d: 'Free key from transitfeeds.com' },
  { p: 'TransitFeeds', u: 'https://api.transitfeeds.com/v1', r: '1000 req/day', docs: 'https://transitfeeds.com/api' },
  ['transit', 'gtfs', 'public-transport', 'feeds'],
  [
    M('get_feeds', 'List Feeds', 2, 'Get a list of GTFS feeds', [{ os: 'location' }], '/getFeeds?page=1&limit=10&descendants=1&type=gtfs&location=${location}', { l: 'results.feeds', f: ['id', 'ty', 'l', 'u'], m: 10 }),
    M('get_locations', 'List Locations', 2, 'Get transit feed locations', [], '/getLocations', { l: 'results.locations', f: ['id', 'pid', 'n', 't', 'lat', 'lng'], m: 15 }),
  ])

G('citybikes', 'CityBikes', 'Worldwide bike-sharing station data from the CityBikes API.', 'https://api.citybik.es/v2',
  {},
  { p: 'CityBikes', u: 'https://api.citybik.es/v2', r: 'Unlimited', docs: 'https://api.citybik.es/v2/' },
  ['bikes', 'sharing', 'cycling', 'stations', 'urban'],
  [
    M('list_networks', 'List Networks', 1, 'Get all bike-sharing networks worldwide', [], '/networks?fields=id,name,location', { l: 'networks', f: ['id', 'name', 'location'], m: 20 }),
    M('get_network', 'Get Network', 1, 'Get station details for a specific network', [{ s: 'network_id' }], '/networks/${network_id}', { f: ['id', 'name', 'location', 'stations'] }),
  ])

G('car-fuel', 'Fuel Economy', 'EPA fuel economy data for vehicles from fueleconomy.gov.', 'https://www.fueleconomy.gov/ws/rest',
  {},
  { p: 'EPA / fueleconomy.gov', u: 'https://www.fueleconomy.gov/ws/rest', r: 'Unlimited', docs: 'https://www.fueleconomy.gov/feg/ws/' },
  ['vehicles', 'fuel', 'economy', 'mpg', 'epa'],
  [
    M('get_years', 'Vehicle Years', 1, 'Get list of available model years', [], '/vehicle/menu/year', { f: ['menuItem'] }),
    M('get_makes', 'Vehicle Makes', 1, 'Get vehicle makes for a given year', [{ n: 'year' }], '/vehicle/menu/make?year=${year}', { f: ['menuItem'] }),
    M('get_vehicle', 'Vehicle Details', 1, 'Get fuel economy details for a vehicle by ID', [{ n: 'id' }], '/vehicle/${id}', { f: ['id', 'make', 'model', 'year', 'city08', 'highway08', 'comb08', 'fuelType'] }),
  ])

G('nhtsa', 'NHTSA', 'Vehicle safety recalls, complaints, and investigations from NHTSA.', 'https://vpic.nhtsa.dot.gov/api',
  {},
  { p: 'NHTSA', u: 'https://vpic.nhtsa.dot.gov/api', r: 'Unlimited', docs: 'https://vpic.nhtsa.dot.gov/api/' },
  ['vehicles', 'safety', 'recalls', 'nhtsa'],
  [
    M('get_makes', 'All Makes', 1, 'Get all vehicle makes', [], '/vehicles/GetAllMakes?format=json', { l: 'Results', f: ['Make_ID', 'Make_Name'], m: 20 }),
    M('get_models', 'Models by Make', 1, 'Get models for a make and year', [{ s: 'make' }, { n: 'year' }], '/vehicles/GetModelsForMakeYear/make/${make}/modelyear/${year}?format=json', { l: 'Results', f: ['Make_Name', 'Model_Name', 'Make_ID', 'Model_ID'], m: 20 }),
    M('decode_vin', 'Decode VIN', 1, 'Decode a Vehicle Identification Number', [{ s: 'vin' }], '/vehicles/DecodeVin/${vin}?format=json', { l: 'Results', f: ['Variable', 'Value', 'ValueId'], m: 25 }),
  ])

G('vin-decoder', 'VIN Decoder', 'Decode Vehicle Identification Numbers via the NHTSA VPIC API.', 'https://vpic.nhtsa.dot.gov/api/vehicles',
  {},
  { p: 'NHTSA VPIC', u: 'https://vpic.nhtsa.dot.gov/api/vehicles', r: 'Unlimited', docs: 'https://vpic.nhtsa.dot.gov/api/' },
  ['vin', 'vehicles', 'decoder', 'nhtsa'],
  [
    M('decode_vin', 'Decode VIN', 1, 'Decode a 17-char VIN to get vehicle specs', [{ s: 'vin' }], '/DecodeVin/${vin}?format=json', { l: 'Results', f: ['Variable', 'Value', 'ValueId'], m: 25 }),
    M('decode_vin_batch', 'Batch Decode VINs', 1, 'Decode multiple VINs (semicolon-separated)', [{ s: 'vins' }], '/DecodeVINValuesBatch/${vins}?format=json', { l: 'Results', f: ['VIN', 'Variable', 'Value'], m: 20 }),
  ])

G('maritime', 'Maritime AIS', 'Live vessel tracking and AIS data from Digitraffic maritime API.', 'https://meri.digitraffic.fi/api/ais/v1',
  {},
  { p: 'Digitraffic', u: 'https://meri.digitraffic.fi/api/ais/v1', r: 'Unlimited', docs: 'https://www.digitraffic.fi/en/marine/' },
  ['maritime', 'ships', 'ais', 'vessels', 'tracking'],
  [
    M('get_vessels', 'All Vessels', 1, 'Get latest AIS positions for all vessels', [], '/locations', { l: 'features', f: ['mmsi', 'properties', 'geometry'], m: 20 }),
    M('get_vessel', 'Vessel by MMSI', 1, 'Get AIS data for a specific vessel by MMSI number', [{ n: 'mmsi' }], '/locations/${mmsi}', { f: ['mmsi', 'name', 'shipType', 'destination', 'geometry'] }),
  ])

G('port-data', 'Port Call Data', 'Port call schedules and vessel visits from Digitraffic.', 'https://meri.digitraffic.fi/api/port-call/v1',
  {},
  { p: 'Digitraffic', u: 'https://meri.digitraffic.fi/api/port-call/v1', r: 'Unlimited', docs: 'https://www.digitraffic.fi/en/marine/' },
  ['maritime', 'ports', 'shipping', 'logistics'],
  [
    M('get_port_calls', 'Port Calls', 1, 'Get recent port calls', [], '/port-calls', { l: 'portCalls', f: ['portCallId', 'portToVisit', 'vesselName', 'eta', 'ata'], m: 15 }),
    M('get_port_call', 'Port Call Detail', 1, 'Get details for a specific port call', [{ n: 'port_call_id' }], '/port-calls/${port_call_id}', { f: ['portCallId', 'portToVisit', 'vesselName', 'nationality', 'eta', 'ata', 'etd', 'atd'] }),
  ])

G('airline-routes', 'Airline Routes', 'Global airline route data from OpenFlights.', 'https://raw.githubusercontent.com/jpatokal/openflights/master/data',
  {},
  { p: 'OpenFlights', u: 'https://openflights.org', r: 'Unlimited (static data)', docs: 'https://openflights.org/data.html' },
  ['aviation', 'airlines', 'routes', 'airports'],
  [
    M('get_airports', 'List Airports', 1, 'Get airport data (CSV parsed) by country', [{ s: 'country' }], '/airports.dat', { f: ['id', 'name', 'city', 'country', 'iata', 'icao', 'latitude', 'longitude'] }),
    M('get_airlines', 'List Airlines', 1, 'Get airline data (CSV parsed) by country', [{ s: 'country' }], '/airlines.dat', { f: ['id', 'name', 'alias', 'iata', 'icao', 'country', 'active'] }),
  ])

G('train-data', 'Finnish Rail', 'Train schedules and live tracking from the Finnish Transport Agency.', 'https://rata.digitraffic.fi/api/v1',
  {},
  { p: 'Digitraffic', u: 'https://rata.digitraffic.fi/api/v1', r: 'Unlimited', docs: 'https://www.digitraffic.fi/en/railway/' },
  ['trains', 'rail', 'schedules', 'finland'],
  [
    M('get_live_trains', 'Live Trains at Station', 1, 'Get live trains arriving/departing a station', [{ s: 'station' }], '/live-trains/station/${station}', { l: '', f: ['trainNumber', 'trainType', 'trainCategory', 'commuterLineID', 'timeTableRows'], m: 10 }),
    M('get_train', 'Train Details', 1, 'Get details of a specific train by number and date', [{ n: 'train_number' }, { s: 'date' }], '/trains/${date}/${train_number}', { f: ['trainNumber', 'trainType', 'trainCategory', 'timetableType', 'timeTableRows'] }),
    M('get_stations', 'All Stations', 1, 'Get all railway stations in Finland', [], '/metadata/stations', { l: '', f: ['stationName', 'stationShortCode', 'countryCode', 'latitude', 'longitude', 'type'], m: 20 }),
  ])

G('ev-charging', 'Open Charge Map', 'Electric vehicle charging station locations worldwide.', 'https://api.openchargemap.io/v3',
  { q: 'key', e: 'OPENCHARGEMAP_API_KEY', d: 'Free key from openchargemap.org' },
  { p: 'Open Charge Map', u: 'https://api.openchargemap.io/v3', r: '100 req/min', docs: 'https://openchargemap.org/site/develop/api' },
  ['ev', 'charging', 'electric-vehicles', 'stations'],
  [
    M('search_chargers', 'Search Chargers', 2, 'Search EV chargers near a lat/lng', [{ n: 'latitude' }, { n: 'longitude' }, { on: 'distance' }], '/poi?output=json&latitude=${latitude}&longitude=${longitude}&distance=${distance}&maxresults=10', { l: '', f: ['ID', 'AddressInfo', 'Connections', 'StatusType', 'UsageCost'], m: 10 }),
    M('get_charger', 'Charger Detail', 2, 'Get details for a specific charging location', [{ n: 'id' }], '/poi?output=json&chargepointid=${id}', { l: '', f: ['ID', 'AddressInfo', 'Connections', 'OperatorInfo', 'StatusType', 'UsageCost'], m: 1 }),
  ])

G('traffic', 'TomTom Traffic', 'Real-time traffic flow and incidents from TomTom.', 'https://api.tomtom.com/traffic',
  { q: 'key', e: 'TOMTOM_API_KEY', d: 'Free key from developer.tomtom.com' },
  { p: 'TomTom', u: 'https://api.tomtom.com/traffic', r: '2500 req/day (free)', docs: 'https://developer.tomtom.com/traffic-api/documentation' },
  ['traffic', 'roads', 'incidents', 'flow'],
  [
    M('get_flow', 'Traffic Flow', 2, 'Get traffic flow data for a road segment', [{ n: 'latitude' }, { n: 'longitude' }], '/services/4/flowSegmentData/absolute/10/json?point=${latitude},${longitude}', { f: ['flowSegmentData'] }),
    M('get_incidents', 'Traffic Incidents', 2, 'Get traffic incidents in a bounding box', [{ n: 'minLat' }, { n: 'minLon' }, { n: 'maxLat' }, { n: 'maxLon' }], '/services/5/incidentDetails?bbox=${minLon},${minLat},${maxLon},${maxLat}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description},startTime,endTime}}}&language=en-US', { l: 'incidents', f: ['type', 'geometry', 'properties'], m: 10 }),
  ])

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO (14)
// ═══════════════════════════════════════════════════════════════════════════════

G('coinpaprika', 'Coinpaprika', 'Cryptocurrency market data, tickers, and coin details from Coinpaprika.', 'https://api.coinpaprika.com/v1',
  {},
  { p: 'Coinpaprika', u: 'https://api.coinpaprika.com/v1', r: '10 req/sec', docs: 'https://api.coinpaprika.com/' },
  ['crypto', 'market-data', 'prices', 'coins'],
  [
    M('list_coins', 'List Coins', 1, 'Get list of all cryptocurrencies', [], '/coins', { l: '', f: ['id', 'name', 'symbol', 'rank', 'is_active', 'type'], m: 20 }),
    M('get_ticker', 'Coin Ticker', 1, 'Get ticker data for a specific coin', [{ s: 'coin_id' }], '/tickers/${coin_id}', { f: ['id', 'name', 'symbol', 'rank', 'quotes'] }),
    M('search_coins', 'Search Coins', 1, 'Search coins by name', [{ s: 'query' }], '/search?q=${query}&c=currencies&limit=10', { l: 'currencies', f: ['id', 'name', 'symbol', 'rank'], m: 10 }),
  ])

G('blockchair', 'Blockchair', 'Multi-chain blockchain explorer — Bitcoin, Ethereum, and more.', 'https://api.blockchair.com',
  {},
  { p: 'Blockchair', u: 'https://api.blockchair.com', r: '30 req/min (free)', docs: 'https://blockchair.com/api/docs' },
  ['crypto', 'blockchain', 'bitcoin', 'ethereum', 'explorer'],
  [
    M('get_stats', 'Chain Stats', 1, 'Get blockchain statistics for a chain', [{ s: 'chain' }], '/${chain}/stats', { l: 'data', f: ['blocks', 'transactions', 'market_price_usd', 'hashrate_24h', 'difficulty', 'mempool_transactions'] }),
    M('get_block', 'Block Info', 1, 'Get block details by height', [{ s: 'chain' }, { n: 'height' }], '/${chain}/dashboards/block/${height}', { f: ['data', 'context'] }),
    M('get_transaction', 'Transaction Info', 1, 'Get transaction details by hash', [{ s: 'chain' }, { s: 'hash' }], '/${chain}/dashboards/transaction/${hash}', { f: ['data', 'context'] }),
  ])

G('blockchain-info', 'Blockchain.info', 'Bitcoin blockchain data — blocks, transactions, and addresses.', 'https://blockchain.info',
  {},
  { p: 'Blockchain.com', u: 'https://blockchain.info', r: '100 req/5min', docs: 'https://www.blockchain.com/api/blockchain_api' },
  ['crypto', 'bitcoin', 'blockchain', 'addresses'],
  [
    M('get_address', 'Address Info', 1, 'Get Bitcoin address balance and transactions', [{ s: 'address' }], '/rawaddr/${address}?limit=10', { f: ['address', 'final_balance', 'n_tx', 'total_received', 'total_sent', 'txs'] }),
    M('get_block', 'Block Info', 1, 'Get Bitcoin block details by hash', [{ s: 'hash' }], '/rawblock/${hash}', { f: ['hash', 'height', 'time', 'n_tx', 'size', 'prev_block'] }),
    M('get_ticker', 'BTC Ticker', 1, 'Get current BTC exchange rates', [], '/ticker', { f: ['USD', 'EUR', 'GBP', 'JPY'] }),
  ])

G('solscan', 'Solscan', 'Solana blockchain explorer — accounts, transactions, and tokens.', 'https://public-api.solscan.io',
  {},
  { p: 'Solscan', u: 'https://public-api.solscan.io', r: '150 req/30sec', docs: 'https://public-api.solscan.io/docs/' },
  ['crypto', 'solana', 'blockchain', 'tokens'],
  [
    M('get_account', 'Account Info', 1, 'Get Solana account details', [{ s: 'address' }], '/account/${address}', { f: ['lamports', 'ownerProgram', 'type', 'rentEpoch'] }),
    M('get_transaction', 'Transaction Info', 1, 'Get Solana transaction details', [{ s: 'signature' }], '/transaction/${signature}', { f: ['blockTime', 'slot', 'fee', 'status', 'signer', 'parsedInstruction'] }),
    M('get_token_holders', 'Token Holders', 1, 'Get top holders of a Solana token', [{ s: 'token_address' }], '/token/holders?tokenAddress=${token_address}&limit=10&offset=0', { l: 'data', f: ['address', 'amount', 'decimals', 'owner'], m: 10 }),
  ])

G('bscscan', 'BscScan', 'Binance Smart Chain explorer — balances, transactions, and tokens.', 'https://api.bscscan.com/api',
  { q: 'apikey', e: 'BSCSCAN_API_KEY', d: 'Free key from bscscan.com' },
  { p: 'BscScan', u: 'https://api.bscscan.com/api', r: '5 req/sec', docs: 'https://docs.bscscan.com/' },
  ['crypto', 'bsc', 'binance', 'blockchain'],
  [
    M('get_balance', 'BNB Balance', 2, 'Get BNB balance for an address', [{ s: 'address' }], '?module=account&action=balance&address=${address}&tag=latest', { f: ['status', 'message', 'result'] }),
    M('get_transactions', 'Transactions', 2, 'Get transaction list for an address', [{ s: 'address' }], '?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc', { l: 'result', f: ['hash', 'from', 'to', 'value', 'timeStamp', 'blockNumber', 'gasUsed'], m: 10 }),
  ])

G('polygonscan', 'PolygonScan', 'Polygon blockchain explorer — balances, transactions, and tokens.', 'https://api.polygonscan.com/api',
  { q: 'apikey', e: 'POLYGONSCAN_API_KEY', d: 'Free key from polygonscan.com' },
  { p: 'PolygonScan', u: 'https://api.polygonscan.com/api', r: '5 req/sec', docs: 'https://docs.polygonscan.com/' },
  ['crypto', 'polygon', 'matic', 'blockchain'],
  [
    M('get_balance', 'MATIC Balance', 2, 'Get MATIC balance for an address', [{ s: 'address' }], '?module=account&action=balance&address=${address}&tag=latest', { f: ['status', 'message', 'result'] }),
    M('get_transactions', 'Transactions', 2, 'Get transaction list for an address', [{ s: 'address' }], '?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc', { l: 'result', f: ['hash', 'from', 'to', 'value', 'timeStamp', 'blockNumber', 'gasUsed'], m: 10 }),
  ])

G('arbiscan', 'Arbiscan', 'Arbitrum blockchain explorer — balances, transactions, and tokens.', 'https://api.arbiscan.io/api',
  { q: 'apikey', e: 'ARBISCAN_API_KEY', d: 'Free key from arbiscan.io' },
  { p: 'Arbiscan', u: 'https://api.arbiscan.io/api', r: '5 req/sec', docs: 'https://docs.arbiscan.io/' },
  ['crypto', 'arbitrum', 'layer2', 'blockchain'],
  [
    M('get_balance', 'ETH Balance', 2, 'Get ETH balance for an Arbitrum address', [{ s: 'address' }], '?module=account&action=balance&address=${address}&tag=latest', { f: ['status', 'message', 'result'] }),
    M('get_transactions', 'Transactions', 2, 'Get transaction list for an address', [{ s: 'address' }], '?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc', { l: 'result', f: ['hash', 'from', 'to', 'value', 'timeStamp', 'blockNumber', 'gasUsed'], m: 10 }),
  ])

G('avalanche', 'Avalanche Glacier', 'Avalanche blockchain data from the Glacier API.', 'https://glacier-api.avax.network/v1',
  {},
  { p: 'Ava Labs', u: 'https://glacier-api.avax.network/v1', r: 'Unlimited', docs: 'https://glacier.docs.avacloud.io/' },
  ['crypto', 'avalanche', 'avax', 'blockchain'],
  [
    M('get_chains', 'List Chains', 1, 'Get all supported Avalanche chains', [], '/chains', { l: 'chains', f: ['chainId', 'chainName', 'vmName', 'explorerUrl', 'networkToken'], m: 10 }),
    M('get_block', 'Block Info', 1, 'Get block details on C-Chain by number', [{ s: 'block_id' }], '/chains/43114/blocks/${block_id}', { f: ['blockNumber', 'blockTimestamp', 'blockHash', 'txCount', 'gasUsed', 'gasLimit'] }),
  ])

G('near', 'NEAR Blocks', 'NEAR Protocol blockchain explorer — accounts, blocks, and transactions.', 'https://api.nearblocks.io/v1',
  {},
  { p: 'NEARBlocks', u: 'https://api.nearblocks.io/v1', r: '6 req/sec', docs: 'https://api.nearblocks.io/api-docs' },
  ['crypto', 'near', 'blockchain', 'accounts'],
  [
    M('get_account', 'Account Info', 1, 'Get NEAR account details', [{ s: 'account_id' }], '/account/${account_id}', { f: ['account_id', 'amount', 'code_hash', 'storage_usage', 'block_height'] }),
    M('get_blocks', 'Recent Blocks', 1, 'Get recent NEAR blocks', [], '/blocks?limit=10', { l: 'blocks', f: ['block_height', 'block_hash', 'author_account_id', 'block_timestamp', 'gas_price'], m: 10 }),
    M('get_txns', 'Recent Transactions', 1, 'Get recent NEAR transactions', [], '/txns?limit=10', { l: 'txns', f: ['transaction_hash', 'signer_account_id', 'receiver_account_id', 'block_timestamp'], m: 10 }),
  ])

G('cosmos', 'Cosmos Hub', 'Cosmos Hub blockchain data — staking, governance, and blocks.', 'https://rest.cosmos.directory/cosmoshub',
  {},
  { p: 'Cosmos Directory', u: 'https://rest.cosmos.directory/cosmoshub', r: 'Unlimited', docs: 'https://cosmos.directory/cosmoshub' },
  ['crypto', 'cosmos', 'atom', 'staking', 'governance'],
  [
    M('get_latest_block', 'Latest Block', 1, 'Get the latest Cosmos Hub block', [], '/cosmos/base/tendermint/v1beta1/blocks/latest', { f: ['block_id', 'block'] }),
    M('get_validators', 'Validators', 1, 'Get active validators', [], '/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=10', { l: 'validators', f: ['operator_address', 'description', 'tokens', 'commission', 'status'], m: 10 }),
    M('get_proposals', 'Governance Proposals', 1, 'Get governance proposals', [], '/cosmos/gov/v1beta1/proposals?pagination.limit=10&pagination.reverse=true', { l: 'proposals', f: ['proposal_id', 'content', 'status', 'final_tally_result', 'submit_time'], m: 10 }),
  ])

G('cardano', 'Blockfrost Cardano', 'Cardano blockchain data from Blockfrost — blocks, addresses, and assets.', 'https://cardano-mainnet.blockfrost.io/api/v0',
  { h: 'project_id', e: 'BLOCKFROST_PROJECT_ID', d: 'Free project ID from blockfrost.io' },
  { p: 'Blockfrost', u: 'https://cardano-mainnet.blockfrost.io/api/v0', r: '500 req/day (free)', docs: 'https://docs.blockfrost.io/' },
  ['crypto', 'cardano', 'ada', 'blockchain'],
  [
    M('get_latest_block', 'Latest Block', 2, 'Get the latest Cardano block', [], '/blocks/latest', { f: ['hash', 'height', 'slot', 'epoch', 'time', 'tx_count', 'size'] }),
    M('get_address', 'Address Info', 2, 'Get Cardano address details', [{ s: 'address' }], '/addresses/${address}', { f: ['address', 'amount', 'stake_address', 'type', 'script'] }),
    M('get_asset', 'Asset Info', 2, 'Get native asset details by policy ID and asset name', [{ s: 'asset' }], '/assets/${asset}', { f: ['asset', 'policy_id', 'asset_name', 'quantity', 'initial_mint_tx_hash', 'metadata'] }),
  ])

G('algorand', 'Algorand', 'Algorand blockchain data — accounts, blocks, and transactions.', 'https://mainnet-api.algonode.cloud/v2',
  {},
  { p: 'AlgoNode', u: 'https://mainnet-api.algonode.cloud/v2', r: 'Unlimited', docs: 'https://developer.algorand.org/docs/rest-apis/algod/' },
  ['crypto', 'algorand', 'algo', 'blockchain'],
  [
    M('get_account', 'Account Info', 1, 'Get Algorand account details', [{ s: 'address' }], '/accounts/${address}', { f: ['address', 'amount', 'status', 'total-apps-opted-in', 'total-assets-opted-in', 'total-created-apps'] }),
    M('get_status', 'Node Status', 1, 'Get Algorand node and network status', [], '/status', { f: ['last-round', 'time-since-last-round', 'last-version', 'catchup-time'] }),
    M('get_block', 'Block Info', 1, 'Get Algorand block by round number', [{ n: 'round' }], '/blocks/${round}', { f: ['block'] }),
  ])

G('tezos', 'TzKT Tezos', 'Tezos blockchain data from TzKT — accounts, operations, and baking.', 'https://api.tzkt.io/v1',
  {},
  { p: 'TzKT', u: 'https://api.tzkt.io/v1', r: '10 req/sec', docs: 'https://api.tzkt.io/' },
  ['crypto', 'tezos', 'xtz', 'blockchain', 'baking'],
  [
    M('get_account', 'Account Info', 1, 'Get Tezos account details', [{ s: 'address' }], '/accounts/${address}', { f: ['address', 'type', 'balance', 'numTransactions', 'firstActivity', 'lastActivity'] }),
    M('get_head', 'Latest Block', 1, 'Get the latest Tezos block', [], '/head', { f: ['level', 'hash', 'timestamp', 'baker', 'priority', 'deposit', 'reward'] }),
    M('get_operations', 'Recent Operations', 1, 'Get recent Tezos operations', [], '/operations/transactions?limit=10&sort.desc=id', { l: '', f: ['hash', 'type', 'sender', 'target', 'amount', 'timestamp', 'status'], m: 10 }),
  ])

G('defi-llama', 'DefiLlama', 'DeFi TVL, protocol data, and yield aggregation from DefiLlama.', 'https://api.llama.fi',
  {},
  { p: 'DefiLlama', u: 'https://api.llama.fi', r: 'Unlimited', docs: 'https://defillama.com/docs/api' },
  ['crypto', 'defi', 'tvl', 'protocols', 'yields'],
  [
    M('get_protocols', 'All Protocols', 1, 'Get TVL data for all DeFi protocols', [], '/protocols', { l: '', f: ['name', 'tvl', 'chain', 'category', 'symbol', 'change_1d', 'change_7d'], m: 20 }),
    M('get_protocol', 'Protocol Detail', 1, 'Get detailed TVL data for a specific protocol', [{ s: 'protocol' }], '/protocol/${protocol}', { f: ['name', 'tvl', 'chains', 'category', 'description', 'url', 'chainTvls'] }),
    M('get_chains', 'Chain TVL', 1, 'Get TVL data grouped by chain', [], '/v2/chains', { l: '', f: ['name', 'tvl', 'tokenSymbol', 'gecko_id'], m: 20 }),
  ])

console.log('\nDone! 29 servers generated.')
