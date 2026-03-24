/**
 * batch-remaining-3.mjs
 *
 * Generates 27 SettleGrid MCP servers (8 Sports + 19 Health/Food)
 * Run: cd /Users/lex/settlegrid && node scripts/batch-remaining-3.mjs
 */

import { G, M } from './lib/generate-auto.mjs'

console.log('\n=== Sports Remaining (8 servers) ===\n')

// ─── 1. Tennis ──────────────────────────────────────────────────────────────
G('tennis', 'Tennis', 'ATP/WTA tennis scores, rankings, and schedules via ESPN.', 'https://site.api.espn.com/apis/site/v2/sports/tennis',
  {},
  { p: 'ESPN', u: 'https://site.api.espn.com', r: '~30 req/min', docs: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  ['sports', 'tennis', 'atp', 'wta'],
  [
    M('search_players', 'Search Players', 1, 'Search tennis players by name', [{s:'query'}], '/atp/athletes?search=${query}', {l:'athletes',f:['id','displayName','citizenship'],m:10}),
    M('get_scoreboard', 'Get Scoreboard', 1, 'Get current tennis scores', [{os:'league'}], '/atp/scoreboard', {l:'events',f:['id','name','date','status'],m:10}),
    M('get_rankings', 'Get Rankings', 1, 'Get current ATP/WTA rankings', [{os:'league'}], '/atp/rankings', {l:'rankings',f:['rank','athlete','points'],m:20}),
  ])

// ─── 2. Rugby ───────────────────────────────────────────────────────────────
G('rugby', 'Rugby', 'Rugby union scores, teams, and schedules via ESPN.', 'https://site.api.espn.com/apis/site/v2/sports/rugby',
  {},
  { p: 'ESPN', u: 'https://site.api.espn.com', r: '~30 req/min', docs: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  ['sports', 'rugby', 'union'],
  [
    M('get_scoreboard', 'Get Scoreboard', 1, 'Get current rugby match scores', [], '/scoreboard', {l:'events',f:['id','name','date','status'],m:10}),
    M('get_teams', 'Get Teams', 1, 'Get rugby teams list', [], '/teams', {l:'teams',f:['id','displayName','abbreviation'],m:20}),
    M('get_team', 'Get Team', 1, 'Get details for a specific rugby team', [{s:'team_id'}], '/teams/${team_id}', {f:['id','displayName','abbreviation','record']}),
  ])

// ─── 3. Golf ────────────────────────────────────────────────────────────────
G('golf', 'Golf', 'PGA Tour golf scores, leaderboards, and schedules via ESPN.', 'https://site.api.espn.com/apis/site/v2/sports/golf',
  {},
  { p: 'ESPN', u: 'https://site.api.espn.com', r: '~30 req/min', docs: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  ['sports', 'golf', 'pga'],
  [
    M('get_scoreboard', 'Get Scoreboard', 1, 'Get current PGA tournament scores', [], '/pga/scoreboard', {l:'events',f:['id','name','date','status'],m:10}),
    M('get_leaderboard', 'Get Leaderboard', 1, 'Get tournament leaderboard', [{s:'event_id'}], '/pga/leaderboard?event=${event_id}', {l:'competitors',f:['id','name','score','position'],m:20}),
  ])

// ─── 4. Cycling ─────────────────────────────────────────────────────────────
G('cycling', 'Cycling', 'Professional cycling race results and rankings via ESPN.', 'https://site.api.espn.com/apis/site/v2/sports/cycling',
  {},
  { p: 'ESPN', u: 'https://site.api.espn.com', r: '~30 req/min', docs: 'https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b' },
  ['sports', 'cycling', 'tour'],
  [
    M('get_scoreboard', 'Get Scoreboard', 1, 'Get current cycling event scores', [], '/scoreboard', {l:'events',f:['id','name','date','status'],m:10}),
    M('get_event', 'Get Event', 1, 'Get cycling event details', [{s:'event_id'}], '/summary?event=${event_id}', {f:['id','name','date','competitions']}),
  ])

// ─── 5. Running ─────────────────────────────────────────────────────────────
G('running', 'Running', 'Marathon and running race data via RunSignUp API.', 'https://runsignup.com/Rest',
  {},
  { p: 'RunSignUp', u: 'https://runsignup.com/API', r: 'Reasonable use', docs: 'https://runsignup.com/API' },
  ['sports', 'running', 'marathon', 'races'],
  [
    M('search_races', 'Search Races', 1, 'Search for running races by name or location', [{s:'query'}], '/races?format=json&name=${query}&results_per_page=10', {l:'races',f:['race_id','name','next_date','city','state'],m:10}),
    M('get_race', 'Get Race', 1, 'Get details for a specific race', [{n:'race_id'}], '/race/${race_id}?format=json', {f:['race_id','name','next_date','address','description']}),
  ])

// ─── 6. Esports ─────────────────────────────────────────────────────────────
G('esports', 'Esports', 'Esports match data, teams, and tournaments via PandaScore.', 'https://api.pandascore.co',
  {b:true, e:'PANDASCORE_TOKEN', d:'PandaScore API token from pandascore.co'},
  { p: 'PandaScore', u: 'https://api.pandascore.co', r: '1000 req/hr (free)', docs: 'https://developers.pandascore.co/docs' },
  ['sports', 'esports', 'gaming', 'tournaments'],
  [
    M('list_matches', 'List Matches', 2, 'List upcoming or recent esports matches', [{os:'game'}], '/matches/upcoming?per_page=10', {l:'',f:['id','name','scheduled_at','status','videogame'],m:10}),
    M('search_teams', 'Search Teams', 2, 'Search esports teams by name', [{s:'query'}], '/teams?search[name]=${query}&per_page=10', {l:'',f:['id','name','acronym','slug'],m:10}),
    M('list_tournaments', 'List Tournaments', 2, 'List current esports tournaments', [{os:'game'}], '/tournaments/running?per_page=10', {l:'',f:['id','name','begin_at','end_at','league'],m:10}),
  ])

// ─── 7. Chess ───────────────────────────────────────────────────────────────
G('chess', 'Chess', 'Chess player stats and games via Chess.com and Lichess APIs.', 'https://api.chess.com/pub',
  {},
  { p: 'Chess.com / Lichess', u: 'https://api.chess.com/pub', r: '~30 req/min', docs: 'https://www.chess.com/news/view/published-data-api' },
  ['sports', 'chess', 'games'],
  [
    M('get_player', 'Get Player', 1, 'Get Chess.com player profile', [{s:'username'}], '/player/${username}', {f:['username','title','followers','country','joined','last_online']}),
    M('get_player_stats', 'Get Player Stats', 1, 'Get Chess.com player rating stats', [{s:'username'}], '/player/${username}/stats', {f:['chess_rapid','chess_blitz','chess_bullet']}),
    M('get_lichess_user', 'Get Lichess User', 1, 'Get Lichess player profile and ratings', [{s:'username'}], '/../../../lichess.org/api/user/${username}', {f:['id','username','perfs','count','playing']}),
  ])

// ─── 8. FIFA ────────────────────────────────────────────────────────────────
G('fifa', 'FIFA', 'FIFA world football rankings and competition data via Football-Data.org.', 'https://api.football-data.org/v4',
  {},
  { p: 'Football-Data.org', u: 'https://api.football-data.org/v4', r: '10 req/min (free)', docs: 'https://www.football-data.org/documentation/quickstart' },
  ['sports', 'football', 'soccer', 'fifa', 'world-cup'],
  [
    M('list_competitions', 'List Competitions', 1, 'List available football competitions', [], '/competitions', {l:'competitions',f:['id','name','area','currentSeason'],m:15}),
    M('get_competition', 'Get Competition', 1, 'Get competition details and standings', [{n:'competition_id'}], '/competitions/${competition_id}/standings', {l:'standings',f:['stage','type','table'],m:5}),
    M('get_team', 'Get Team', 1, 'Get team details and squad', [{n:'team_id'}], '/teams/${team_id}', {f:['id','name','shortName','crest','venue','squad']}),
  ])

console.log('\n=== Health / Food (19 servers) ===\n')

// ─── 9. WHO Data ────────────────────────────────────────────────────────────
G('who-data', 'WHO Data', 'World Health Organization health indicators and statistics.', 'https://ghoapi.azureedge.net/api',
  {},
  { p: 'WHO GHO', u: 'https://ghoapi.azureedge.net/api', r: 'No published limit', docs: 'https://www.who.int/data/gho/info/gho-odata-api' },
  ['health', 'who', 'global-health', 'statistics'],
  [
    M('list_indicators', 'List Indicators', 1, 'List available WHO health indicators', [{os:'query'}], '/Indicator?$filter=contains(IndicatorName,\'${query}\')', {l:'value',f:['IndicatorCode','IndicatorName'],m:15}),
    M('get_indicator_data', 'Get Indicator Data', 1, 'Get data for a specific WHO indicator by country', [{s:'indicator_code'},{os:'country'}], '/${indicator_code}?$filter=SpatialDim eq \'${country}\'', {l:'value',f:['SpatialDim','TimeDim','NumericValue','Value'],m:20}),
  ])

// ─── 10. HealthData.gov ─────────────────────────────────────────────────────
G('healthdata-gov', 'HealthData.gov', 'US federal health datasets from HealthData.gov CKAN catalog.', 'https://healthdata.gov/api/3',
  {},
  { p: 'HealthData.gov', u: 'https://healthdata.gov/api/3', r: 'No published limit', docs: 'https://healthdata.gov' },
  ['health', 'us-health', 'datasets', 'government'],
  [
    M('search_datasets', 'Search Datasets', 1, 'Search US health datasets by keyword', [{s:'query'}], '/action/package_search?q=${query}&rows=10', {l:'result.results',f:['id','title','notes','organization'],m:10}),
    M('get_dataset', 'Get Dataset', 1, 'Get dataset details by ID', [{s:'dataset_id'}], '/action/package_show?id=${dataset_id}', {f:['id','title','notes','resources','organization']}),
  ])

// ─── 11. CDC Data ───────────────────────────────────────────────────────────
G('cdc-data', 'CDC Data', 'US CDC health statistics and surveillance data via SODA API.', 'https://data.cdc.gov/api',
  {},
  { p: 'CDC / Socrata', u: 'https://data.cdc.gov', r: '~1000 req/hr unauth', docs: 'https://dev.socrata.com/foundry/data.cdc.gov' },
  ['health', 'cdc', 'us-health', 'surveillance'],
  [
    M('search_datasets', 'Search Datasets', 1, 'Search CDC datasets by keyword', [{s:'query'}], '/catalog/v1?q=${query}&limit=10', {l:'results',f:['resource.id','resource.name','resource.description'],m:10}),
    M('query_dataset', 'Query Dataset', 1, 'Query a specific CDC dataset', [{s:'dataset_id'},{os:'query'}], '/id/${dataset_id}.json?$limit=10', {l:'',f:[],m:10}),
  ])

// ─── 12. Disease.sh ─────────────────────────────────────────────────────────
G('disease-sh', 'Disease.sh', 'Global disease and epidemic tracking data including COVID-19 and influenza.', 'https://disease.sh/v3',
  {},
  { p: 'Disease.sh', u: 'https://disease.sh', r: 'No published limit', docs: 'https://disease.sh/docs/' },
  ['health', 'disease', 'epidemiology', 'covid'],
  [
    M('get_global', 'Get Global', 1, 'Get global COVID-19 statistics', [], '/covid-19/all', {f:['cases','deaths','recovered','active','todayCases','todayDeaths']}),
    M('get_country', 'Get Country', 1, 'Get COVID-19 data for a specific country', [{s:'country'}], '/covid-19/countries/${country}', {f:['country','cases','deaths','recovered','active','population']}),
    M('get_influenza', 'Get Influenza', 1, 'Get influenza data from CDC ILINet', [], '/influenza/ILINet', {l:'data',f:['week','year','totalILI','totalPatients'],m:10}),
  ])

// ─── 13. OpenAQ ─────────────────────────────────────────────────────────────
G('openaq', 'OpenAQ', 'Global air quality measurements from thousands of monitoring stations.', 'https://api.openaq.org/v2',
  {},
  { p: 'OpenAQ', u: 'https://api.openaq.org', r: '~120 req/min', docs: 'https://docs.openaq.org/' },
  ['health', 'air-quality', 'environment', 'pollution'],
  [
    M('get_latest', 'Get Latest', 1, 'Get latest air quality measurements by city or country', [{os:'city'},{os:'country'}], '/latest?limit=10&city=${city}&country=${country}', {l:'results',f:['location','city','country','measurements'],m:10}),
    M('get_locations', 'Get Locations', 1, 'Search air quality monitoring locations', [{os:'city'},{os:'country'}], '/locations?limit=10&city=${city}&country=${country}', {l:'results',f:['id','name','city','country','parameters'],m:10}),
    M('get_measurements', 'Get Measurements', 1, 'Get air quality measurements for a location', [{n:'location_id'}], '/measurements?location_id=${location_id}&limit=20', {l:'results',f:['parameter','value','unit','date'],m:20}),
  ])

// ─── 14. Open Food Facts ────────────────────────────────────────────────────
G('open-food-facts', 'Open Food Facts', 'Global food product database with nutrition data, ingredients, and allergens.', 'https://world.openfoodfacts.org/api/v2',
  {},
  { p: 'Open Food Facts', u: 'https://world.openfoodfacts.org', r: '~100 req/min', docs: 'https://openfoodfacts.github.io/openfoodfacts-server/api/' },
  ['food', 'nutrition', 'products', 'barcode'],
  [
    M('search_products', 'Search Products', 1, 'Search food products by name', [{s:'query'}], '/search?search_terms=${query}&page_size=10&json=true', {l:'products',f:['code','product_name','brands','nutriscore_grade','nutriments'],m:10}),
    M('get_product', 'Get Product', 1, 'Get food product details by barcode', [{s:'barcode'}], '/product/${barcode}.json', {f:['code','product_name','brands','ingredients_text','nutriments','allergens']}),
  ])

// ─── 15. Edamam ─────────────────────────────────────────────────────────────
G('edamam', 'Edamam', 'Recipe search and nutrition analysis with detailed dietary information.', 'https://api.edamam.com/api',
  {q:'app_id', e:'EDAMAM_APP_ID', d:'Edamam Application ID from developer.edamam.com'},
  { p: 'Edamam', u: 'https://api.edamam.com', r: '10 req/min (free)', docs: 'https://developer.edamam.com/edamam-docs-recipe-api' },
  ['food', 'recipes', 'nutrition', 'diet'],
  [
    M('search_recipes', 'Search Recipes', 2, 'Search recipes by keyword', [{s:'query'}], '/recipes/v2?type=public&q=${query}&app_key=${process.env.EDAMAM_APP_KEY}', {l:'hits',f:['recipe.label','recipe.source','recipe.url','recipe.calories','recipe.dietLabels'],m:10}),
    M('search_food', 'Search Food', 2, 'Search food database for nutrition info', [{s:'query'}], '/food-database/v2/parser?ingr=${query}&app_key=${process.env.EDAMAM_APP_KEY}', {l:'hints',f:['food.foodId','food.label','food.nutrients','food.category'],m:10}),
  ])

// ─── 16. TheMealDB ──────────────────────────────────────────────────────────
G('themealdb', 'TheMealDB', 'Free meal and recipe database with categories, ingredients, and instructions.', 'https://www.themealdb.com/api/json/v1/1',
  {},
  { p: 'TheMealDB', u: 'https://www.themealdb.com/api.php', r: '~100 req/day (free)', docs: 'https://www.themealdb.com/api.php' },
  ['food', 'recipes', 'meals', 'cooking'],
  [
    M('search_meals', 'Search Meals', 1, 'Search meals by name', [{s:'query'}], '/search.php?s=${query}', {l:'meals',f:['idMeal','strMeal','strCategory','strArea','strInstructions','strMealThumb'],m:10}),
    M('get_meal', 'Get Meal', 1, 'Get meal details by ID', [{s:'meal_id'}], '/lookup.php?i=${meal_id}', {l:'meals',f:['idMeal','strMeal','strCategory','strArea','strInstructions','strIngredient1','strIngredient2','strIngredient3'],m:1}),
    M('random_meal', 'Random Meal', 1, 'Get a random meal recipe', [], '/random.php', {l:'meals',f:['idMeal','strMeal','strCategory','strArea','strInstructions','strMealThumb'],m:1}),
  ])

// ─── 17. Spoonacular ────────────────────────────────────────────────────────
G('spoonacular', 'Spoonacular', 'Comprehensive recipe and food API with meal planning and nutrition.', 'https://api.spoonacular.com',
  {q:'apiKey', e:'SPOONACULAR_API_KEY', d:'Spoonacular API key from spoonacular.com/food-api'},
  { p: 'Spoonacular', u: 'https://api.spoonacular.com', r: '150 req/day (free)', docs: 'https://spoonacular.com/food-api/docs' },
  ['food', 'recipes', 'meal-planning', 'nutrition'],
  [
    M('search_recipes', 'Search Recipes', 2, 'Search recipes by query', [{s:'query'}], '/recipes/complexSearch?query=${query}&number=10', {l:'results',f:['id','title','image','sourceUrl'],m:10}),
    M('get_recipe', 'Get Recipe', 2, 'Get recipe details including instructions', [{n:'recipe_id'}], '/recipes/${recipe_id}/information', {f:['id','title','instructions','readyInMinutes','servings','sourceUrl']}),
    M('search_ingredients', 'Search Ingredients', 2, 'Search food ingredients', [{s:'query'}], '/food/ingredients/search?query=${query}&number=10', {l:'results',f:['id','name','image'],m:10}),
  ])

// ─── 18. BreweryDB (Open Brewery DB) ────────────────────────────────────────
G('brewerydb', 'BreweryDB', 'Open brewery database with locations, types, and contact information.', 'https://api.openbrewerydb.org/v1/breweries',
  {},
  { p: 'Open Brewery DB', u: 'https://www.openbrewerydb.org', r: 'No published limit', docs: 'https://www.openbrewerydb.org/documentation' },
  ['food', 'beer', 'breweries', 'drinks'],
  [
    M('search_breweries', 'Search Breweries', 1, 'Search breweries by name', [{s:'query'}], '?by_name=${query}&per_page=10', {l:'',f:['id','name','brewery_type','city','state','country','website_url'],m:10}),
    M('get_brewery', 'Get Brewery', 1, 'Get brewery details by ID', [{s:'brewery_id'}], '/${brewery_id}', {f:['id','name','brewery_type','street','city','state','country','phone','website_url']}),
    M('list_by_city', 'List by City', 1, 'List breweries in a specific city', [{s:'city'}], '?by_city=${city}&per_page=10', {l:'',f:['id','name','brewery_type','street','state','website_url'],m:10}),
  ])

// ─── 19. OpenBeer (also Open Brewery DB) ────────────────────────────────────
G('openbeer', 'OpenBeer', 'Beer and brewery discovery using the Open Brewery DB dataset.', 'https://api.openbrewerydb.org/v1/breweries',
  {},
  { p: 'Open Brewery DB', u: 'https://www.openbrewerydb.org', r: 'No published limit', docs: 'https://www.openbrewerydb.org/documentation' },
  ['food', 'beer', 'breweries', 'craft-beer'],
  [
    M('search_by_type', 'Search by Type', 1, 'Search breweries by type (micro, nano, brewpub, etc.)', [{s:'type'}], '?by_type=${type}&per_page=10', {l:'',f:['id','name','brewery_type','city','state','country'],m:10}),
    M('search_by_state', 'Search by State', 1, 'Search breweries by US state', [{s:'state'}], '?by_state=${state}&per_page=10', {l:'',f:['id','name','brewery_type','city','website_url'],m:10}),
    M('random_breweries', 'Random Breweries', 1, 'Get random breweries', [], '/../random?size=5', {l:'',f:['id','name','brewery_type','city','state','country'],m:5}),
  ])

// ─── 20. Wine API ───────────────────────────────────────────────────────────
G('wine-api', 'Wine API', 'Wine database with varieties including reds, whites, sparkling, and dessert wines.', 'https://api.sampleapis.com/wines',
  {},
  { p: 'SampleAPIs', u: 'https://api.sampleapis.com', r: 'No published limit', docs: 'https://sampleapis.com/api-list/wines' },
  ['food', 'wine', 'drinks', 'beverages'],
  [
    M('list_reds', 'List Reds', 1, 'Get list of red wines', [], '/reds', {l:'',f:['id','wine','winery','rating','location'],m:15}),
    M('list_whites', 'List Whites', 1, 'Get list of white wines', [], '/whites', {l:'',f:['id','wine','winery','rating','location'],m:15}),
    M('list_sparkling', 'List Sparkling', 1, 'Get list of sparkling wines', [], '/sparkling', {l:'',f:['id','wine','winery','rating','location'],m:15}),
  ])

// ─── 21. Calorie Ninjas ─────────────────────────────────────────────────────
G('calorie-ninjas', 'Calorie Ninjas', 'Natural language nutrition lookup — calories, macros, and micronutrients.', 'https://api.calorieninjas.com/v1',
  {h:'X-Api-Key', e:'CALORIE_NINJAS_KEY', d:'CalorieNinjas API key from calorieninjas.com'},
  { p: 'CalorieNinjas', u: 'https://calorieninjas.com', r: '~10,000 req/mo (free)', docs: 'https://calorieninjas.com/api' },
  ['food', 'nutrition', 'calories', 'diet'],
  [
    M('get_nutrition', 'Get Nutrition', 2, 'Get nutrition info for a food item (natural language)', [{s:'query'}], '/nutrition?query=${query}', {l:'items',f:['name','calories','protein_g','fat_total_g','carbohydrates_total_g','fiber_g','sugar_g'],m:10}),
  ])

// ─── 22. ExerciseDB ─────────────────────────────────────────────────────────
G('exercisedb', 'ExerciseDB', 'Exercise database with body part targeting, equipment, and GIF animations.', 'https://exercisedb.p.rapidapi.com',
  {h:'X-RapidAPI-Key', e:'RAPIDAPI_KEY', d:'RapidAPI key from rapidapi.com'},
  { p: 'ExerciseDB (RapidAPI)', u: 'https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb', r: '100 req/day (free)', docs: 'https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb' },
  ['health', 'exercise', 'fitness', 'workout'],
  [
    M('search_exercises', 'Search Exercises', 2, 'Search exercises by name', [{s:'query'}], '/exercises/name/${query}?limit=10', {l:'',f:['id','name','bodyPart','equipment','target','gifUrl'],m:10}),
    M('list_by_bodypart', 'List by Body Part', 2, 'List exercises targeting a body part', [{s:'bodypart'}], '/exercises/bodyPart/${bodypart}?limit=10', {l:'',f:['id','name','equipment','target','gifUrl'],m:10}),
    M('list_by_equipment', 'List by Equipment', 2, 'List exercises using specific equipment', [{s:'equipment'}], '/exercises/equipment/${equipment}?limit=10', {l:'',f:['id','name','bodyPart','target','gifUrl'],m:10}),
  ])

// ─── 23. Yoga API ───────────────────────────────────────────────────────────
G('yoga-api', 'Yoga API', 'Yoga pose database with categories, descriptions, and benefits.', 'https://yoga-api-nzy4.onrender.com/v1',
  {},
  { p: 'Yoga API', u: 'https://yoga-api-nzy4.onrender.com', r: 'No published limit', docs: 'https://github.com/alexcumplido/yoga-api' },
  ['health', 'yoga', 'fitness', 'wellness'],
  [
    M('list_categories', 'List Categories', 1, 'List all yoga pose categories', [], '/categories', {l:'',f:['id','category_name','category_description'],m:20}),
    M('get_category_poses', 'Get Category Poses', 1, 'Get yoga poses by category ID', [{n:'category_id'}], '/categories?id=${category_id}', {l:'poses',f:['id','english_name','sanskrit_name','pose_description','pose_benefits'],m:20}),
    M('list_poses', 'List Poses', 1, 'List all yoga poses', [], '/poses', {l:'',f:['id','english_name','sanskrit_name','pose_description','pose_benefits'],m:20}),
  ])

// ─── 24. COVID Tracking ─────────────────────────────────────────────────────
G('covid-tracking', 'COVID Tracking', 'COVID-19 global and country-level statistics with historical data.', 'https://disease.sh/v3/covid-19',
  {},
  { p: 'Disease.sh', u: 'https://disease.sh', r: 'No published limit', docs: 'https://disease.sh/docs/' },
  ['health', 'covid', 'pandemic', 'tracking'],
  [
    M('get_global', 'Get Global', 1, 'Get global COVID-19 totals', [], '/all', {f:['cases','deaths','recovered','active','todayCases','todayDeaths','population']}),
    M('get_country', 'Get Country', 1, 'Get COVID-19 stats for a specific country', [{s:'country'}], '/countries/${country}', {f:['country','cases','deaths','recovered','active','casesPerOneMillion','deathsPerOneMillion']}),
    M('get_historical', 'Get Historical', 1, 'Get historical COVID-19 data for a country', [{s:'country'},{os:'days'}], '/historical/${country}?lastdays=${days}', {f:['country','timeline']}),
  ])

// ─── 25. Vaccination Data ───────────────────────────────────────────────────
G('vaccination-data', 'Vaccination Data', 'COVID-19 vaccination coverage statistics by country.', 'https://disease.sh/v3/covid-19/vaccine',
  {},
  { p: 'Disease.sh', u: 'https://disease.sh', r: 'No published limit', docs: 'https://disease.sh/docs/' },
  ['health', 'vaccination', 'covid', 'immunization'],
  [
    M('get_global_coverage', 'Get Global Coverage', 1, 'Get global vaccination coverage totals', [], '/coverage?lastdays=30&fullData=true', {l:'',f:['date','total','daily'],m:30}),
    M('get_country_coverage', 'Get Country Coverage', 1, 'Get vaccination coverage for a country', [{s:'country'}], '/coverage/countries/${country}?lastdays=30&fullData=true', {l:'timeline',f:['date','total','daily'],m:30}),
  ])

// ─── 26. Healthcare.gov ─────────────────────────────────────────────────────
G('healthcare-gov', 'Healthcare.gov', 'US Healthcare.gov glossary, articles, and marketplace information.', 'https://data.healthcare.gov/api',
  {},
  { p: 'Healthcare.gov', u: 'https://data.healthcare.gov', r: 'No published limit', docs: 'https://data.healthcare.gov' },
  ['health', 'insurance', 'healthcare', 'us-government'],
  [
    M('search_datasets', 'Search Datasets', 1, 'Search Healthcare.gov datasets', [{s:'query'}], '/3/action/package_search?q=${query}&rows=10', {l:'result.results',f:['id','title','notes','organization'],m:10}),
    M('get_dataset', 'Get Dataset', 1, 'Get a specific Healthcare.gov dataset', [{s:'dataset_id'}], '/3/action/package_show?id=${dataset_id}', {f:['id','title','notes','resources']}),
  ])

// ─── 27. Drugs FDA ──────────────────────────────────────────────────────────
G('drugs-fda', 'Drugs FDA', 'FDA drug labeling, adverse events, and recall data via openFDA.', 'https://api.fda.gov/drug',
  {},
  { p: 'openFDA', u: 'https://api.fda.gov', r: '240 req/min (no key), 120k/day (with key)', docs: 'https://open.fda.gov/apis/drug/' },
  ['health', 'fda', 'drugs', 'pharmaceutical'],
  [
    M('search_labels', 'Search Labels', 1, 'Search drug labels by brand or generic name', [{s:'query'}], '/label.json?search=openfda.brand_name:"${query}"&limit=10', {l:'results',f:['openfda.brand_name','openfda.generic_name','openfda.manufacturer_name','indications_and_usage'],m:10}),
    M('search_adverse_events', 'Search Adverse Events', 1, 'Search drug adverse event reports', [{s:'drug_name'}], '/event.json?search=patient.drug.medicinalproduct:"${drug_name}"&limit=10', {l:'results',f:['receivedate','serious','patient.drug','patient.reaction'],m:10}),
    M('search_recalls', 'Search Recalls', 1, 'Search drug recall enforcement reports', [{os:'query'}], '/enforcement.json?search=reason_for_recall:"${query}"&limit=10', {l:'results',f:['recall_number','reason_for_recall','product_description','status','classification'],m:10}),
  ])

console.log('\n=== Done: 27 servers generated ===\n')
