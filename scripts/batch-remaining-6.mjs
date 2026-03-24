/**
 * batch-remaining-6.mjs
 *
 * Generates 30 SettleGrid MCP servers using compact auto-generator:
 *   Environment/Energy (15): electricity-maps, epa-data, renewable-energy, carbon-footprint,
 *     water-quality, forest-data, ocean-data, glacier-data, wildlife, wildfire, air-pollution,
 *     solar-data, wind-data, disaster-events, climate-change
 *   Real Estate/Housing (15): zillow, realtor, rentcast, walk-score, hud-data, fhfa,
 *     mortgage-rates, construction, census-housing, airbnb-data, property-tax, school-ratings,
 *     crime-mapping, commute-data, demographics
 *
 * Run: cd /Users/lex/settlegrid && node scripts/batch-remaining-6.mjs
 */

import { G, M } from './lib/generate-auto.mjs'

console.log('\n=== Environment/Energy Servers (15) ===\n')

// ─── 1. electricity-maps ────────────────────────────────────────────────────
G('electricity-maps', 'Electricity Maps', 'Real-time carbon intensity and power breakdown by zone via Electricity Maps.', 'https://api.electricitymap.org/v3',
  { h: 'auth-token', e: 'ELECTRICITYMAP_TOKEN', d: 'Free token from electricitymaps.com' },
  { p: 'Electricity Maps', u: 'https://api.electricitymap.org/v3', r: '30 req/hr (free)', docs: 'https://static.electricitymaps.com/api/docs/index.html' },
  ['environment', 'energy', 'carbon', 'electricity', 'emissions'],
  [
    M('get_carbon_intensity', 'Carbon Intensity', 2, 'Get real-time carbon intensity for a zone', [{s:'zone'}], '/carbon-intensity/latest?zone=${zone}', {f:['zone','carbonIntensity','datetime','updatedAt']}),
    M('get_power_breakdown', 'Power Breakdown', 2, 'Get power generation breakdown by source for a zone', [{s:'zone'}], '/power-breakdown/latest?zone=${zone}', {f:['zone','powerConsumptionBreakdown','powerProductionBreakdown','datetime']}),
  ])

// ─── 2. epa-data ────────────────────────────────────────────────────────────
G('epa-data', 'EPA Environmental Data', 'US EPA air quality and environmental monitoring data from AQS API.', 'https://aqs.epa.gov/data/api',
  {},
  { p: 'US EPA', u: 'https://aqs.epa.gov/data/api', r: 'Reasonable use', docs: 'https://aqs.epa.gov/aqsweb/documents/data_api.html' },
  ['environment', 'epa', 'air-quality', 'pollution', 'government'],
  [
    M('list_states', 'List States', 1, 'List all US states with monitoring data', [], '/list/states?email=test@aqs.api&key=test', {l:'Data',f:['code','value_represented'],m:60}),
    M('get_monitors', 'Get Monitors', 1, 'Get air quality monitors by state and county', [{s:'state'},{s:'county'}], '/monitors/byCounty?email=test@aqs.api&key=test&param=44201&bdate=20240101&edate=20240131&state=${state}&county=${county}', {l:'Data',f:['si_id','local_site_name','status','latitude','longitude'],m:20}),
  ])

// ─── 3. renewable-energy ────────────────────────────────────────────────────
G('renewable-energy', 'US EIA Energy Data', 'US Energy Information Administration data on renewable and conventional energy.', 'https://api.eia.gov/v2',
  { q: 'api_key', e: 'EIA_API_KEY', d: 'Free key from eia.gov' },
  { p: 'US EIA', u: 'https://api.eia.gov/v2', r: 'Reasonable use', docs: 'https://www.eia.gov/opendata/documentation.php' },
  ['energy', 'renewable', 'eia', 'electricity', 'solar', 'wind'],
  [
    M('get_electricity', 'Get Electricity Data', 2, 'Get electricity generation data by source', [{os:'fuel_type'}], '/electricity/electric-power-operational-data/data/?frequency=monthly&data[0]=generation&sort[0][column]=period&sort[0][direction]=desc&length=10&offset=0${fuel_type ? "&facets[fueltypeid][]=" + fuel_type : ""}', {l:'response.data',f:['period','fueltypeid','generation','generation-units'],m:10}),
    M('get_total_energy', 'Get Total Energy', 2, 'Get total energy production and consumption stats', [{os:'series'}], '/total-energy/data/?frequency=monthly&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=10${series ? "&facets[msn][]=" + series : ""}', {l:'response.data',f:['period','msn','value','unit'],m:10}),
  ])

// ─── 4. carbon-footprint ────────────────────────────────────────────────────
G('carbon-footprint', 'Carbon Interface', 'Carbon footprint estimation for vehicles, flights, electricity, and shipping.', 'https://www.carboninterface.com/api/v1',
  { b: true, e: 'CARBON_INTERFACE_KEY', d: 'Free key from carboninterface.com' },
  { p: 'Carbon Interface', u: 'https://www.carboninterface.com/api/v1', r: '200 req/mo (free)', docs: 'https://docs.carboninterface.com/' },
  ['environment', 'carbon', 'emissions', 'footprint', 'sustainability'],
  [
    M('estimate_vehicle', 'Estimate Vehicle', 2, 'Estimate CO2 emissions for a vehicle trip by distance', [{n:'distance_value'},{s:'distance_unit'}], '/estimates', {f:['data']}),
    M('estimate_electricity', 'Estimate Electricity', 2, 'Estimate CO2 for electricity usage by kWh and country', [{n:'electricity_value'},{s:'country'}], '/estimates', {f:['data']}),
  ])

// ─── 5. water-quality ───────────────────────────────────────────────────────
G('water-quality', 'Water Quality Data', 'US water quality monitoring data from the Water Quality Portal (USGS/EPA).', 'https://www.waterqualitydata.us/data',
  {},
  { p: 'Water Quality Portal (USGS/EPA)', u: 'https://www.waterqualitydata.us', r: 'Reasonable use', docs: 'https://www.waterqualitydata.us/webservices_documentation/' },
  ['environment', 'water', 'quality', 'usgs', 'epa', 'monitoring'],
  [
    M('search_stations', 'Search Stations', 1, 'Search water monitoring stations by state', [{s:'statecode'}], '/Station/search?statecode=${statecode}&mimeType=geojson&sorted=no&zip=no', {l:'features',f:['properties'],m:15}),
    M('get_results', 'Get Results', 1, 'Get water quality results by site ID', [{s:'siteid'}], '/Result/search?siteid=${siteid}&mimeType=geojson&sorted=no&zip=no', {l:'features',f:['properties'],m:15}),
  ])

// ─── 6. forest-data ─────────────────────────────────────────────────────────
G('forest-data', 'Global Forest Watch', 'Deforestation and forest cover data from Global Forest Watch.', 'https://data-api.globalforestwatch.org',
  {},
  { p: 'Global Forest Watch', u: 'https://data-api.globalforestwatch.org', r: 'Reasonable use', docs: 'https://data-api.globalforestwatch.org/' },
  ['environment', 'forest', 'deforestation', 'trees', 'land-use'],
  [
    M('get_datasets', 'Get Datasets', 1, 'List available forest datasets', [], '/dataset', {l:'data',f:['dataset','metadata'],m:15}),
    M('get_tree_cover_loss', 'Get Tree Cover Loss', 1, 'Get tree cover loss statistics by ISO country', [{s:'iso'}], '/dataset/umd_tree_cover_loss/latest/query/iso?iso=${iso}', {l:'data',f:['iso','year','area_loss','emissions'],m:25}),
  ])

// ─── 7. ocean-data ──────────────────────────────────────────────────────────
G('ocean-data', 'ERDDAP Ocean Data', 'Ocean and coastal data from NOAA CoastWatch ERDDAP.', 'https://coastwatch.pfeg.noaa.gov/erddap',
  {},
  { p: 'NOAA CoastWatch', u: 'https://coastwatch.pfeg.noaa.gov/erddap', r: 'Reasonable use', docs: 'https://coastwatch.pfeg.noaa.gov/erddap/information.html' },
  ['ocean', 'marine', 'sea', 'noaa', 'temperature', 'salinity'],
  [
    M('search_datasets', 'Search Datasets', 1, 'Search ocean datasets by keyword', [{s:'query'}], '/search/index.json?page=1&itemsPerPage=10&searchFor=${query}', {l:'table.rows',f:['griddap','title','summary'],m:10}),
    M('get_dataset_info', 'Get Dataset Info', 1, 'Get metadata for a specific dataset', [{s:'dataset_id'}], '/info/${dataset_id}/index.json', {l:'table.rows',f:['Row Type','Variable Name','Attribute Name','Value'],m:20}),
  ])

// ─── 8. glacier-data ────────────────────────────────────────────────────────
G('glacier-data', 'Glacier Monitoring (NCEI)', 'Global glacier monitoring data from NOAA NCEI.', 'https://www.ncei.noaa.gov',
  {},
  { p: 'NOAA NCEI', u: 'https://www.ncei.noaa.gov', r: 'Reasonable use', docs: 'https://www.ncei.noaa.gov/access' },
  ['glacier', 'ice', 'climate', 'noaa', 'cryosphere'],
  [
    M('search_datasets', 'Search Datasets', 1, 'Search glacier and ice datasets', [{os:'query'}], '/cdo-web/api/v2/datasets?datatypeid=SNOW&limit=10', {l:'results',f:['id','name','mindate','maxdate','datacoverage'],m:10}),
    M('get_stations', 'Get Stations', 1, 'Get monitoring stations by location', [{s:'locationid'}], '/cdo-web/api/v2/stations?locationid=${locationid}&limit=10', {l:'results',f:['id','name','latitude','longitude','elevation','mindate','maxdate'],m:10}),
  ])

// ─── 9. wildlife ─────────────────────────────────────────────────────────────
G('wildlife', 'IUCN Red List', 'Endangered species data from the IUCN Red List of Threatened Species.', 'https://apiv3.iucnredlist.org/api/v3',
  { q: 'token', e: 'IUCN_TOKEN', d: 'Free token from apiv3.iucnredlist.org/api/v3/token' },
  { p: 'IUCN', u: 'https://apiv3.iucnredlist.org/api/v3', r: 'Reasonable use', docs: 'https://apiv3.iucnredlist.org/api/v3/docs' },
  ['wildlife', 'endangered', 'species', 'conservation', 'biodiversity'],
  [
    M('search_species', 'Search Species', 2, 'Search species by name', [{s:'name'}], '/species/${name}', {l:'result',f:['taxonid','scientific_name','category','main_common_name'],m:10}),
    M('get_country_species', 'Country Species', 2, 'Get species list for a country by ISO code', [{s:'iso'}], '/country/getspecies/${iso}', {l:'result',f:['taxonid','scientific_name','category','subspecies','rank'],m:20}),
  ])

// ─── 10. wildfire ────────────────────────────────────────────────────────────
G('wildfire', 'Wildfire Events', 'Active wildfire events from NASA EONET (Earth Observatory Natural Event Tracker).', 'https://eonet.gsfc.nasa.gov/api/v3',
  {},
  { p: 'NASA EONET', u: 'https://eonet.gsfc.nasa.gov/api/v3', r: 'Reasonable use', docs: 'https://eonet.gsfc.nasa.gov/docs/v3' },
  ['wildfire', 'fire', 'nasa', 'disaster', 'environment'],
  [
    M('get_active_fires', 'Active Fires', 1, 'Get currently active wildfire events', [], '/events?category=wildfires&status=open&limit=20', {l:'events',f:['id','title','geometry','categories','sources'],m:20}),
    M('get_fire_by_id', 'Get Fire', 1, 'Get details for a specific fire event by ID', [{s:'id'}], '/events/${id}', {f:['id','title','description','geometry','categories','sources']}),
  ])

// ─── 11. air-pollution ──────────────────────────────────────────────────────
G('air-pollution', 'OpenAQ Air Pollution', 'Global air quality measurements from OpenAQ monitoring network.', 'https://api.openaq.org/v2',
  {},
  { p: 'OpenAQ', u: 'https://api.openaq.org/v2', r: '60 req/min', docs: 'https://docs.openaq.org/' },
  ['air', 'pollution', 'pm25', 'aqi', 'environment', 'health'],
  [
    M('get_latest', 'Get Latest', 1, 'Get latest air quality measurements by country', [{s:'country'}], '/latest?country=${country}&limit=15&order_by=lastUpdated&sort=desc', {l:'results',f:['location','city','country','measurements'],m:15}),
    M('get_locations', 'Get Locations', 1, 'Search monitoring locations by city name', [{s:'city'}], '/locations?city=${city}&limit=15&order_by=lastUpdated&sort=desc', {l:'results',f:['id','name','city','country','parameters','lastUpdated','coordinates'],m:15}),
  ])

// ─── 12. solar-data ─────────────────────────────────────────────────────────
G('solar-data', 'NREL Solar Data', 'Solar irradiance and photovoltaic resource data from NREL.', 'https://developer.nrel.gov/api/solar',
  { q: 'api_key', e: 'NREL_API_KEY', d: 'Free key from developer.nrel.gov' },
  { p: 'NREL', u: 'https://developer.nrel.gov/api/solar', r: '1000 req/hr', docs: 'https://developer.nrel.gov/docs/solar/' },
  ['solar', 'energy', 'irradiance', 'renewable', 'nrel', 'photovoltaic'],
  [
    M('get_solar_resource', 'Solar Resource', 2, 'Get solar resource data for a lat/lon', [{n:'lat'},{n:'lon'}], '/solar_resource/v1.json?lat=${lat}&lon=${lon}', {f:['outputs','station_info']}),
    M('get_pvwatts', 'PVWatts', 2, 'Estimate PV system energy production', [{n:'lat'},{n:'lon'},{n:'system_capacity'}], '/pvwatts/v8.json?lat=${lat}&lon=${lon}&system_capacity=${system_capacity}&module_type=0&losses=14&array_type=1&tilt=20&azimuth=180', {f:['outputs','station_info']}),
  ])

// ─── 13. wind-data ──────────────────────────────────────────────────────────
G('wind-data', 'NREL Wind Data', 'Wind energy resource data and toolkit from NREL.', 'https://developer.nrel.gov/api/wind-toolkit',
  { q: 'api_key', e: 'NREL_API_KEY', d: 'Free key from developer.nrel.gov' },
  { p: 'NREL', u: 'https://developer.nrel.gov/api/wind-toolkit', r: '1000 req/hr', docs: 'https://developer.nrel.gov/docs/wind/wind-toolkit/' },
  ['wind', 'energy', 'renewable', 'nrel', 'turbine'],
  [
    M('get_wind_resource', 'Wind Resource', 2, 'Get wind resource data for a location', [{n:'lat'},{n:'lon'}], '/v2/wind/wtk-srw-download.json?lat=${lat}&lon=${lon}&year=2014&hubheight=100', {f:['outputs','metadata']}),
    M('get_wind_speed', 'Wind Speed', 2, 'Get nearest wind speed data point', [{n:'lat'},{n:'lon'}], '/v2/wind/wtk-download.json?lat=${lat}&lon=${lon}&year=2014&attributes=windspeed_100m&utc=true&interval=60&leap_day=false', {f:['outputs','metadata']}),
  ])

// ─── 14. disaster-events ────────────────────────────────────────────────────
G('disaster-events', 'Natural Disaster Events', 'Natural disaster event tracking from NASA EONET.', 'https://eonet.gsfc.nasa.gov/api/v3',
  {},
  { p: 'NASA EONET', u: 'https://eonet.gsfc.nasa.gov/api/v3', r: 'Reasonable use', docs: 'https://eonet.gsfc.nasa.gov/docs/v3' },
  ['disaster', 'earthquake', 'volcano', 'storm', 'nasa', 'eonet'],
  [
    M('get_events', 'Get Events', 1, 'Get recent natural disaster events', [{os:'category'}], '/events?status=open&limit=20${category ? "&category=" + category : ""}', {l:'events',f:['id','title','categories','geometry','sources'],m:20}),
    M('get_categories', 'Get Categories', 1, 'List available event categories', [], '/categories', {l:'categories',f:['id','title','description','link'],m:15}),
    M('get_event', 'Get Event', 1, 'Get details for a specific event by ID', [{s:'id'}], '/events/${id}', {f:['id','title','description','categories','geometry','sources']}),
  ])

// ─── 15. climate-change ─────────────────────────────────────────────────────
G('climate-change', 'Climate Change Indicators', 'Climate change indicators and temperature data from World Bank.', 'https://api.worldbank.org/v2',
  {},
  { p: 'World Bank', u: 'https://api.worldbank.org/v2', r: 'Reasonable use', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/topics/125589' },
  ['climate', 'temperature', 'co2', 'emissions', 'worldbank', 'global-warming'],
  [
    M('get_co2_emissions', 'CO2 Emissions', 1, 'Get CO2 emissions per capita by country ISO code', [{s:'country'}], '/country/${country}/indicator/EN.ATM.CO2E.PC?format=json&per_page=20&mrv=20', {l:'1',f:['date','value','country','indicator'],m:20}),
    M('get_temperature_change', 'Temperature Change', 1, 'Get average temperature data by country', [{s:'country'}], '/country/${country}/indicator/EN.CLC.MDAT.ZS?format=json&per_page=10&mrv=10', {l:'1',f:['date','value','country','indicator'],m:10}),
    M('get_forest_area', 'Forest Area %', 1, 'Get forest area as percentage of land by country', [{s:'country'}], '/country/${country}/indicator/AG.LND.FRST.ZS?format=json&per_page=10&mrv=10', {l:'1',f:['date','value','country','indicator'],m:10}),
  ])

console.log('\n=== Real Estate/Housing Servers (15) ===\n')

// ─── 16. zillow ─────────────────────────────────────────────────────────────
G('zillow', 'Zillow (Bridge API)', 'Home values and property listings via the Bridge Interactive API.', 'https://api.bridgedataoutput.com/api/v2',
  { b: true, e: 'BRIDGE_API_TOKEN', d: 'API token from bridgedataoutput.com' },
  { p: 'Bridge Interactive', u: 'https://api.bridgedataoutput.com/api/v2', r: 'Plan-based', docs: 'https://bridgedataoutput.com/docs/platform' },
  ['real-estate', 'zillow', 'property', 'home-value', 'housing'],
  [
    M('search_properties', 'Search Properties', 2, 'Search property listings by city and state', [{s:'city'},{s:'state'}], '/OData/test/Property?$filter=City eq \'${city}\' and StateOrProvince eq \'${state}\'&$top=10', {l:'value',f:['ListingId','ListPrice','City','StateOrProvince','BedroomsTotal','BathroomsTotalInteger','LivingArea'],m:10}),
    M('get_property', 'Get Property', 2, 'Get details for a specific listing', [{s:'listing_id'}], '/OData/test/Property(\'${listing_id}\')', {f:['ListingId','ListPrice','City','StateOrProvince','BedroomsTotal','BathroomsTotalInteger','LivingArea','LotSizeArea','YearBuilt']}),
  ])

// ─── 17. realtor ────────────────────────────────────────────────────────────
G('realtor', 'ATTOM Property Data', 'Property data, valuations, and sales via the ATTOM API.', 'https://api.gateway.attomdata.com/propertyapi/v1.0.0',
  { q: 'apikey', e: 'ATTOM_API_KEY', d: 'API key from attomdata.com' },
  { p: 'ATTOM Data', u: 'https://api.gateway.attomdata.com', r: 'Plan-based', docs: 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/docs' },
  ['real-estate', 'property', 'valuation', 'attom', 'housing'],
  [
    M('search_properties', 'Search Properties', 2, 'Search properties by address', [{s:'address1'},{s:'address2'}], '/property/address?address1=${address1}&address2=${address2}', {l:'property',f:['identifier','lot','address','summary','building'],m:10}),
    M('get_avm', 'Get AVM', 2, 'Get automated valuation model for a property', [{s:'address1'},{s:'address2'}], '/attomavm/detail?address1=${address1}&address2=${address2}', {l:'property',f:['identifier','address','avm'],m:5}),
  ])

// ─── 18. rentcast ───────────────────────────────────────────────────────────
G('rentcast', 'Rentcast', 'Rental estimates, property records, and market data via Rentcast.', 'https://api.rentcast.io/v1',
  { h: 'X-Api-Key', e: 'RENTCAST_API_KEY', d: 'API key from rentcast.io' },
  { p: 'Rentcast', u: 'https://api.rentcast.io/v1', r: '100 req/mo (free)', docs: 'https://developers.rentcast.io/reference' },
  ['rental', 'rent', 'estimate', 'property', 'housing', 'market'],
  [
    M('get_rent_estimate', 'Rent Estimate', 2, 'Get rental estimate for a property by address', [{s:'address'}], '/avm/rent/long-term?address=${address}', {f:['rent','rentRangeLow','rentRangeHigh','latitude','longitude']}),
    M('get_market_stats', 'Market Stats', 2, 'Get rental market statistics by zip code', [{s:'zipCode'}], '/markets?zipCode=${zipCode}', {l:'',f:['zipCode','city','state','medianRent','averageRent','rentalListings'],m:5}),
  ])

// ─── 19. walk-score ─────────────────────────────────────────────────────────
G('walk-score', 'Walk Score', 'Walkability, transit, and bike scores for any address.', 'https://api.walkscore.com',
  { q: 'wsapikey', e: 'WALKSCORE_API_KEY', d: 'Free key from walkscore.com/professional/api.php' },
  { p: 'Walk Score', u: 'https://api.walkscore.com', r: '5000 req/day (free)', docs: 'https://www.walkscore.com/professional/api.php' },
  ['walkability', 'transit', 'bike', 'score', 'real-estate', 'commute'],
  [
    M('get_score', 'Get Walk Score', 2, 'Get walk, transit, and bike scores for an address', [{s:'address'},{n:'lat'},{n:'lon'}], '/score?format=json&transit=1&bike=1&address=${address}&lat=${lat}&lon=${lon}', {f:['walkscore','description','transit','bike']}),
  ])

// ─── 20. hud-data ───────────────────────────────────────────────────────────
G('hud-data', 'HUD Housing Data', 'Fair market rents and income limits from HUD.', 'https://www.huduser.gov/hudapi/public',
  {},
  { p: 'HUD User', u: 'https://www.huduser.gov/hudapi/public', r: 'Reasonable use', docs: 'https://www.huduser.gov/portal/dataset/fmr-api.html' },
  ['hud', 'housing', 'rent', 'fair-market', 'income-limits', 'government'],
  [
    M('get_fair_market_rent', 'Fair Market Rent', 1, 'Get fair market rents by state FIPS code', [{s:'stateid'}], '/fmr/statedata/${stateid}', {l:'data.metroareas',f:['area_name','Efficiency','One-Bedroom','Two-Bedroom','Three-Bedroom','Four-Bedroom'],m:15}),
    M('get_income_limits', 'Income Limits', 1, 'Get income limits by state FIPS code', [{s:'stateid'}], '/il/statedata/${stateid}', {l:'data',f:['area_name','median_income','low_50','very_low_50'],m:15}),
  ])

// ─── 21. fhfa ───────────────────────────────────────────────────────────────
G('fhfa', 'FHFA Housing Price Index', 'Housing price index data via the FRED API (Federal Reserve).', 'https://api.stlouisfed.org/fred',
  {},
  { p: 'FRED (Federal Reserve)', u: 'https://api.stlouisfed.org/fred', r: '120 req/min', docs: 'https://fred.stlouisfed.org/docs/api/fred/' },
  ['housing', 'price-index', 'fhfa', 'fred', 'real-estate', 'economics'],
  [
    M('get_hpi', 'Get HPI', 1, 'Get FHFA House Price Index series observations', [{os:'series_id'}], '/series/observations?series_id=${series_id || "USSTHPI"}&file_type=json&sort_order=desc&limit=20', {l:'observations',f:['date','value'],m:20}),
    M('search_series', 'Search Series', 1, 'Search FRED for housing price series', [{s:'query'}], '/series/search?search_text=${query}&file_type=json&limit=10&tag_names=housing', {l:'seriess',f:['id','title','frequency','units','seasonal_adjustment'],m:10}),
  ])

// ─── 22. mortgage-rates ─────────────────────────────────────────────────────
G('mortgage-rates', 'Mortgage Rates', 'US Treasury rates and fiscal data for mortgage rate tracking.', 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service',
  {},
  { p: 'US Treasury Fiscal Data', u: 'https://api.fiscaldata.treasury.gov', r: 'Reasonable use', docs: 'https://fiscaldata.treasury.gov/api-documentation/' },
  ['mortgage', 'rates', 'treasury', 'interest', 'housing', 'finance'],
  [
    M('get_treasury_rates', 'Treasury Rates', 1, 'Get recent Treasury yield curve rates', [], '/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=10', {l:'data',f:['record_date','security_desc','avg_interest_rate_amt'],m:10}),
    M('get_debt_data', 'Get Debt Data', 1, 'Get public debt outstanding data', [], '/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=10', {l:'data',f:['record_date','tot_pub_debt_out_amt','intragov_hold_amt'],m:10}),
  ])

// ─── 23. construction ───────────────────────────────────────────────────────
G('construction', 'Census Construction', 'US construction permits and housing starts from Census Bureau.', 'https://api.census.gov/data',
  { q: 'key', e: 'CENSUS_API_KEY', d: 'Free key from api.census.gov/data/key_signup.html' },
  { p: 'US Census Bureau', u: 'https://api.census.gov/data', r: '500 req/day', docs: 'https://www.census.gov/data/developers/data-sets/building-permits.html' },
  ['construction', 'permits', 'housing-starts', 'census', 'building'],
  [
    M('get_permits', 'Get Permits', 2, 'Get building permits data by state', [{s:'state'}], '/2023/bps/moperm?get=NAME,PER_TOTAL,PER1_TOTAL,PER24_TOTAL,PER5PLUS_TOTAL&for=state:${state}', {f:['NAME','PER_TOTAL','PER1_TOTAL','PER24_TOTAL','PER5PLUS_TOTAL']}),
    M('get_housing_units', 'Housing Units', 2, 'Get housing unit counts by state', [{s:'state'}], '/2022/acs/acs1?get=NAME,B25001_001E,B25002_002E,B25002_003E&for=state:${state}', {f:['NAME','B25001_001E','B25002_002E','B25002_003E']}),
  ])

// ─── 24. census-housing ─────────────────────────────────────────────────────
G('census-housing', 'Census Housing Data', 'Detailed housing statistics from the American Community Survey.', 'https://api.census.gov/data',
  { q: 'key', e: 'CENSUS_API_KEY', d: 'Free key from api.census.gov/data/key_signup.html' },
  { p: 'US Census Bureau', u: 'https://api.census.gov/data', r: '500 req/day', docs: 'https://www.census.gov/data/developers/data-sets/acs-1year.html' },
  ['census', 'housing', 'acs', 'demographics', 'real-estate'],
  [
    M('get_housing_values', 'Housing Values', 2, 'Get median home values by state', [{s:'state'}], '/2022/acs/acs1?get=NAME,B25077_001E,B25064_001E,B25003_002E,B25003_003E&for=state:${state}', {f:['NAME','B25077_001E','B25064_001E','B25003_002E','B25003_003E']}),
    M('get_housing_by_county', 'Housing by County', 2, 'Get housing data for all counties in a state', [{s:'state'}], '/2022/acs/acs5?get=NAME,B25077_001E,B25064_001E&for=county:*&in=state:${state}', {l:'',f:['NAME','B25077_001E','B25064_001E'],m:20}),
  ])

// ─── 25. airbnb-data ────────────────────────────────────────────────────────
G('airbnb-data', 'Inside Airbnb', 'Airbnb listing and market data from Inside Airbnb open dataset.', 'http://data.insideairbnb.com',
  {},
  { p: 'Inside Airbnb', u: 'http://data.insideairbnb.com', r: 'Reasonable use', docs: 'http://insideairbnb.com/get-the-data/' },
  ['airbnb', 'rental', 'short-term', 'vacation', 'housing', 'market'],
  [
    M('get_cities', 'Get Cities', 1, 'List available cities with Airbnb data', [], '/csv/index.json', {l:'',f:['city','country','last_scraped','listings_url'],m:20}),
    M('get_summary', 'Get Summary', 1, 'Get listing summary for a city', [{s:'country'},{s:'city'}], '/csv/${country}/${city}/visualisations/listings.csv', {f:['data']}),
  ])

// ─── 26. property-tax ───────────────────────────────────────────────────────
G('property-tax', 'HUD Property Tax', 'Property tax and housing affordability data from HUD.', 'https://www.huduser.gov/hudapi/public',
  {},
  { p: 'HUD User', u: 'https://www.huduser.gov/hudapi/public', r: 'Reasonable use', docs: 'https://www.huduser.gov/portal/dataset/fmr-api.html' },
  ['property-tax', 'housing', 'affordability', 'hud', 'government'],
  [
    M('get_state_data', 'State Data', 1, 'Get housing cost data by state FIPS code', [{s:'stateid'}], '/fmr/statedata/${stateid}', {l:'data.metroareas',f:['area_name','Efficiency','One-Bedroom','Two-Bedroom','Three-Bedroom'],m:15}),
    M('get_area_data', 'Area Data', 1, 'Get fair market rent by CBSA code', [{s:'cbsa'}], '/fmr/data/${cbsa}', {f:['area_name','year','Efficiency','One-Bedroom','Two-Bedroom','Three-Bedroom','Four-Bedroom']}),
  ])

// ─── 27. school-ratings ─────────────────────────────────────────────────────
G('school-ratings', 'SchoolDigger', 'School quality ratings and rankings from SchoolDigger.', 'https://api.schooldigger.com/v2.0',
  { q: 'appID', e: 'SCHOOLDIGGER_APP_ID', d: 'App ID from developer.schooldigger.com' },
  { p: 'SchoolDigger', u: 'https://api.schooldigger.com/v2.0', r: '50 req/day (free)', docs: 'https://developer.schooldigger.com/' },
  ['school', 'education', 'rating', 'ranking', 'real-estate'],
  [
    M('search_schools', 'Search Schools', 2, 'Search schools by location', [{s:'st'},{os:'city'}], '/schools?st=${st}${city ? "&city=" + city : ""}&perPage=10&appKey=${process.env.SCHOOLDIGGER_APP_KEY || ""}', {l:'schoolList',f:['schoolid','schoolName','city','state','rankHistory','schoolLevel'],m:10}),
    M('get_school', 'Get School', 2, 'Get details for a school by ID', [{s:'id'}], '/schools/${id}?appKey=${process.env.SCHOOLDIGGER_APP_KEY || ""}', {f:['schoolid','schoolName','address','phone','schoolLevel','rankHistory','testScores']}),
  ])

// ─── 28. crime-mapping ──────────────────────────────────────────────────────
G('crime-mapping', 'FBI Crime Data', 'Crime statistics from the FBI Crime Data Explorer API.', 'https://api.usa.gov/crime/fbi/sapi',
  {},
  { p: 'FBI CJIS', u: 'https://api.usa.gov/crime/fbi/sapi', r: 'Reasonable use', docs: 'https://crime-data-explorer.fr.cloud.gov/pages/docApi' },
  ['crime', 'safety', 'fbi', 'statistics', 'real-estate'],
  [
    M('get_state_crime', 'State Crime', 1, 'Get crime summary for a state abbreviation', [{s:'state'}], '/api/estimates/states/${state}/2022/2022?API_KEY=iiHnOKfno2Mgkt5AynpvPpUQTEyxE77jo1RU8PIv', {l:'results',f:['year','state_abbr','population','violent_crime','property_crime'],m:5}),
    M('get_national_crime', 'National Crime', 1, 'Get national crime estimates', [], '/api/estimates/national/2018/2022?API_KEY=iiHnOKfno2Mgkt5AynpvPpUQTEyxE77jo1RU8PIv', {l:'results',f:['year','population','violent_crime','property_crime','homicide','robbery'],m:5}),
  ])

// ─── 29. commute-data ───────────────────────────────────────────────────────
G('commute-data', 'Census Commute Data', 'Commuting patterns and travel time data from Census ACS.', 'https://api.census.gov/data',
  { q: 'key', e: 'CENSUS_API_KEY', d: 'Free key from api.census.gov/data/key_signup.html' },
  { p: 'US Census Bureau', u: 'https://api.census.gov/data', r: '500 req/day', docs: 'https://www.census.gov/data/developers/data-sets/acs-1year.html' },
  ['commute', 'travel-time', 'transportation', 'census', 'real-estate'],
  [
    M('get_commute_by_state', 'Commute by State', 2, 'Get commute times and modes by state', [{s:'state'}], '/2022/acs/acs1?get=NAME,B08303_001E,B08301_003E,B08301_010E,B08006_017E&for=state:${state}', {f:['NAME','B08303_001E','B08301_003E','B08301_010E','B08006_017E']}),
    M('get_commute_by_county', 'Commute by County', 2, 'Get commute data for all counties in a state', [{s:'state'}], '/2022/acs/acs5?get=NAME,B08303_001E,B08301_003E,B08301_010E&for=county:*&in=state:${state}', {l:'',f:['NAME','B08303_001E','B08301_003E','B08301_010E'],m:20}),
  ])

// ─── 30. demographics ───────────────────────────────────────────────────────
G('demographics', 'Census Demographics', 'Population, age, race, and income demographics from Census ACS.', 'https://api.census.gov/data',
  { q: 'key', e: 'CENSUS_API_KEY', d: 'Free key from api.census.gov/data/key_signup.html' },
  { p: 'US Census Bureau', u: 'https://api.census.gov/data', r: '500 req/day', docs: 'https://www.census.gov/data/developers/data-sets/acs-1year.html' },
  ['demographics', 'population', 'census', 'income', 'real-estate'],
  [
    M('get_state_demographics', 'State Demographics', 2, 'Get population, income, and age data by state', [{s:'state'}], '/2022/acs/acs1?get=NAME,B01003_001E,B19013_001E,B01002_001E,B02001_002E,B02001_003E&for=state:${state}', {f:['NAME','B01003_001E','B19013_001E','B01002_001E','B02001_002E','B02001_003E']}),
    M('get_county_demographics', 'County Demographics', 2, 'Get demographics for all counties in a state', [{s:'state'}], '/2022/acs/acs5?get=NAME,B01003_001E,B19013_001E,B01002_001E&for=county:*&in=state:${state}', {l:'',f:['NAME','B01003_001E','B19013_001E','B01002_001E'],m:25}),
  ])

console.log('\n=== Done! 30 servers generated. ===\n')
