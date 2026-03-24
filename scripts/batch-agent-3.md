# SettleGrid MCP Server Generation — Batch 3 (Agent 3)

## Your Mission

Generate MCP server projects at `/Users/lex/settlegrid/open-source-servers/`. Each project is a complete, deployable MCP server wrapping a free public API with SettleGrid billing pre-wired.

## Reference Template

Look at any existing server in `/Users/lex/settlegrid/open-source-servers/` (e.g., `settlegrid-weather-gov/`) for the exact file structure and quality bar. Each project must have:

```
settlegrid-{name}/
├── package.json          # name, @settlegrid/mcp dependency, scripts
├── tsconfig.json         # strict TypeScript, ES2022
├── src/server.ts         # MCP server with settlegrid.init() + sg.wrap()
├── .env.example          # API key placeholders
├── .gitignore            # node_modules, dist, .env
├── README.md             # Title, deploy badge, methods table, setup
├── Dockerfile            # Node.js 22 alpine
├── vercel.json           # { "buildCommand": "npm run build" }
└── LICENSE               # MIT, Copyright 2026 Alerterra, LLC
```

## Your API List (330 servers)

Generate ALL of these. Each one is a separate project directory.

### International Government Data (40)
1. settlegrid-uk-gov-data — UK government datasets (no key)
2. settlegrid-uk-nhs — NHS health data (no key)
3. settlegrid-uk-transport — UK transport data (free key)
4. settlegrid-uk-police — UK crime data (no key)
5. settlegrid-uk-weather — UK Met Office (free key)
6. settlegrid-france-data — data.gouv.fr (no key)
7. settlegrid-france-sirene — French company data (no key)
8. settlegrid-germany-data — German open data (no key)
9. settlegrid-germany-destatis — German statistics (no key)
10. settlegrid-italy-data — Italian open data (no key)
11. settlegrid-spain-data — datos.gob.es (no key)
12. settlegrid-netherlands-cbs — Dutch statistics (no key)
13. settlegrid-sweden-scb — Swedish statistics (no key)
14. settlegrid-norway-ssb — Norwegian statistics (no key)
15. settlegrid-denmark-dst — Danish statistics (no key)
16. settlegrid-finland-stat — Finnish statistics (no key)
17. settlegrid-switzerland-data — Swiss open data (no key)
18. settlegrid-austria-data — Austrian open data (no key)
19. settlegrid-poland-data — Polish open data (no key)
20. settlegrid-czech-data — Czech open data (no key)
21. settlegrid-israel-data — Israeli open data (no key)
22. settlegrid-singapore-data — Singapore open data (no key)
23. settlegrid-hong-kong-data — HK open data (no key)
24. settlegrid-taiwan-data — Taiwan open data (no key)
25. settlegrid-new-zealand-data — NZ open data (no key)
26. settlegrid-south-africa-data — SA open data (no key)
27. settlegrid-nigeria-data — Nigerian data (no key)
28. settlegrid-kenya-data — Kenyan open data (no key)
29. settlegrid-egypt-data — Egyptian data (no key)
30. settlegrid-turkey-data — Turkish statistics (no key)
31. settlegrid-russia-data — Russian statistics (no key)
32. settlegrid-china-data — Chinese economic data (no key)
33. settlegrid-indonesia-data — Indonesian statistics (no key)
34. settlegrid-thailand-data — Thai statistics (no key)
35. settlegrid-vietnam-data — Vietnamese data (no key)
36. settlegrid-philippines-data — Philippine data (no key)
37. settlegrid-colombia-data — Colombian data (no key)
38. settlegrid-argentina-data — Argentine data (no key)
39. settlegrid-chile-data — Chilean data (no key)
40. settlegrid-peru-data — Peruvian data (no key)

### International Organizations (30)
41. settlegrid-world-trade — WTO trade data (no key)
42. settlegrid-un-population — UN population data (no key)
43. settlegrid-un-refugees — UNHCR refugee data (no key)
44. settlegrid-unicef — UNICEF child welfare data (no key)
45. settlegrid-fao-food — FAO food/agriculture (no key)
46. settlegrid-ilo-labor — ILO labor statistics (no key)
47. settlegrid-wipo-patents — WIPO patent data (no key)
48. settlegrid-iaea-nuclear — IAEA nuclear data (no key)
49. settlegrid-itu-telecom — ITU telecom data (no key)
50. settlegrid-who-gho — WHO Global Health Observatory (no key)
51. settlegrid-world-bank-climate — World Bank climate data (no key)
52. settlegrid-world-bank-education — World Bank education (no key)
53. settlegrid-world-bank-health — World Bank health (no key)
54. settlegrid-world-bank-poverty — World Bank poverty (no key)
55. settlegrid-imf-weo — IMF World Economic Outlook (no key)
56. settlegrid-oecd-education — OECD education stats (no key)
57. settlegrid-oecd-health — OECD health stats (no key)
58. settlegrid-oecd-environment — OECD environment stats (no key)
59. settlegrid-bis-banking — Bank for Intl Settlements (no key)
60. settlegrid-fatf-data — FATF country assessments (no key)
61. settlegrid-transparency-intl — Corruption Perceptions Index (no key)
62. settlegrid-freedom-house — Freedom Index data (no key)
63. settlegrid-heritage-economic — Economic Freedom Index (no key)
64. settlegrid-v-dem — Democracy indices (no key)
65. settlegrid-global-peace — Global Peace Index (no key)
66. settlegrid-human-development — Human Development Index (no key)
67. settlegrid-world-happiness — World Happiness Report (no key)
68. settlegrid-press-freedom — Press Freedom Index (no key)
69. settlegrid-fragile-states — Fragile States Index (no key)
70. settlegrid-gender-gap — Gender Gap Index (no key)

### Niche Science/Research (40)
71. settlegrid-genbank — Genomic sequence data (no key)
72. settlegrid-uniprot — Protein data (no key)
73. settlegrid-drugbank — Drug information (no key for basic)
74. settlegrid-clinicaltrials — Clinical trial data (no key)
75. settlegrid-ncbi-gene — Gene information (no key)
76. settlegrid-ensembl — Genome browser data (no key)
77. settlegrid-kegg — Pathway/genome data (no key)
78. settlegrid-covid-genome — COVID genomic data (no key)
79. settlegrid-plant-data — Plant biology data (no key)
80. settlegrid-marine-biology — Marine species data (no key)
81. settlegrid-bird-data — eBird observation data (free key)
82. settlegrid-butterfly-data — Butterfly species data (no key)
83. settlegrid-mineral-data — Mineral database (no key)
84. settlegrid-asteroid-data — Asteroid tracking (no key)
85. settlegrid-exoplanet — Exoplanet data (no key)
86. settlegrid-solar-system — Solar system data (no key)
87. settlegrid-star-catalog — Star/constellation data (no key)
88. settlegrid-satellite-tle — Satellite tracking (no key)
89. settlegrid-weather-balloon — Radiosonde data (no key)
90. settlegrid-lightning-data — Lightning strike data (no key)
91. settlegrid-soil-data — Soil composition data (no key)
92. settlegrid-river-data — River flow/level data (no key)
93. settlegrid-lake-data — Lake/reservoir data (no key)
94. settlegrid-volcano-data — Volcanic activity (no key)
95. settlegrid-tide-data — Tidal predictions (no key)
96. settlegrid-wave-data — Ocean wave data (no key)
97. settlegrid-snow-data — Snowfall/snowpack data (no key)
98. settlegrid-drought-data — Drought monitoring (no key)
99. settlegrid-aurora — Aurora forecast data (no key)
100. settlegrid-space-weather — Space weather alerts (no key)
101. settlegrid-radiation — Environmental radiation (no key)
102. settlegrid-paleoclimate — Historical climate data (no key)
103. settlegrid-fossil-data — Fossil record data (no key)
104. settlegrid-archaeology — Archaeological site data (no key)
105. settlegrid-linguistics — Language data (no key)
106. settlegrid-etymology — Word origin data (no key)
107. settlegrid-census-historical — Historical census data (no key)
108. settlegrid-historical-events — Historical event timeline (no key)
109. settlegrid-war-data — Conflict/war data (no key)
110. settlegrid-migration-data — Migration statistics (no key)

### Niche Finance/Markets (30)
111. settlegrid-forex-rates — Forex exchange rates (free key)
112. settlegrid-commodity-prices — Oil/gold/silver prices (no key)
113. settlegrid-stock-screener — Stock screening API (free key)
114. settlegrid-dividend-data — Dividend history (no key)
115. settlegrid-ipo-calendar — Upcoming IPOs (no key)
116. settlegrid-earnings-calendar — Earnings dates (no key)
117. settlegrid-economic-calendar — Economic events (no key)
118. settlegrid-insider-trading — SEC insider trades (no key)
119. settlegrid-institutional — 13F institutional holdings (no key)
120. settlegrid-short-interest — Short selling data (no key)
121. settlegrid-options-data — Options chain data (free key)
122. settlegrid-futures-data — Futures market data (free key)
123. settlegrid-bond-yields — Government bond yields (no key)
124. settlegrid-cds-spreads — Credit default swap data (no key)
125. settlegrid-vix — Volatility index data (no key)
126. settlegrid-pe-ratios — Historical P/E ratios (no key)
127. settlegrid-market-cap — Market capitalization data (no key)
128. settlegrid-sector-performance — Sector/industry returns (no key)
129. settlegrid-etf-data — ETF holdings/performance (no key)
130. settlegrid-mutual-fund — Mutual fund data (no key)
131. settlegrid-reit-data — REIT performance data (no key)
132. settlegrid-venture-capital — VC/startup funding (no key)
133. settlegrid-crowdfunding — Crowdfunding data (no key)
134. settlegrid-banking-rates — Savings/CD rates (no key)
135. settlegrid-credit-card — Credit card comparison (no key)
136. settlegrid-insurance-rates — Insurance rate data (no key)
137. settlegrid-tax-rates — Global tax rates (no key)
138. settlegrid-inflation — Inflation rate data (no key)
139. settlegrid-gdp-data — GDP by country/quarter (no key)
140. settlegrid-unemployment — Unemployment rates (no key)

### Academic/Research Tools (20)
141. settlegrid-google-scholar — Scholar search (no key, scrape)
142. settlegrid-core-api — Open access papers (free key)
143. settlegrid-doaj — Open access journals (no key)
144. settlegrid-orcid — Researcher profiles (no key)
145. settlegrid-ror — Research organization data (no key)
146. settlegrid-datacite — DOI metadata (no key)
147. settlegrid-europe-pmc — European PubMed Central (no key)
148. settlegrid-bioarxiv — Biology preprints (no key)
149. settlegrid-medrxiv — Medical preprints (no key)
150. settlegrid-ssrn — Social science papers (no key)
151. settlegrid-repec — Economics papers (no key)
152. settlegrid-math-genealogy — Math genealogy (no key)
153. settlegrid-retraction-watch — Retracted papers (no key)
154. settlegrid-altmetric — Research impact data (free key)
155. settlegrid-dimensions — Research analytics (free key)
156. settlegrid-lens-org — Patent/scholarly search (free key)
157. settlegrid-openapc — Publication costs (no key)
158. settlegrid-unpaywall — Open access finder (no key)
159. settlegrid-sherpa-romeo — Journal policies (no key)
160. settlegrid-fatcat — Scholarly catalog (no key)

### IoT/Hardware/Embedded (15)
161. settlegrid-thingspeak — IoT data channels (free key)
162. settlegrid-particle — IoT device data (free key)
163. settlegrid-adafruit-io — IoT feeds (free key)
164. settlegrid-openiot — IoT platform data (no key)
165. settlegrid-sensor-community — Air quality sensors (no key)
166. settlegrid-purpleair — Air quality network (free key)
167. settlegrid-smart-citizen — Citizen science sensors (no key)
168. settlegrid-arduino-cloud — Arduino IoT data (free key)
169. settlegrid-iss-tracker — ISS position/crew (no key)
170. settlegrid-ham-radio — Amateur radio data (no key)
171. settlegrid-adsb-data — Aircraft ADS-B data (no key)
172. settlegrid-ais-data — Ship AIS data (no key)
173. settlegrid-radio-browser — Internet radio stations (no key)
174. settlegrid-cell-tower — Cell tower locations (no key)
175. settlegrid-wifi-data — WiFi network data (no key)

### Agriculture/Farming (15)
176. settlegrid-usda-nass — USDA crop statistics (free key)
177. settlegrid-usda-ers — Economic research service (no key)
178. settlegrid-crop-data — Global crop production (no key)
179. settlegrid-livestock — Livestock statistics (no key)
180. settlegrid-soil-survey — USDA soil survey (no key)
181. settlegrid-weather-crop — Weather impact on crops (no key)
182. settlegrid-commodity-futures — Agricultural futures (no key)
183. settlegrid-food-prices — Global food prices (no key)
184. settlegrid-farm-subsidies — Farm subsidy data (no key)
185. settlegrid-organic — Organic certification data (no key)
186. settlegrid-pesticide — Pesticide usage data (no key)
187. settlegrid-irrigation — Irrigation data (no key)
188. settlegrid-fisheries — Global fisheries data (no key)
189. settlegrid-timber — Timber/forestry data (no key)
190. settlegrid-biofuel — Biofuel production data (no key)

### Legal/Compliance (15)
191. settlegrid-courtlistener — US court opinions (free key)
192. settlegrid-case-law — Historical case law (no key)
193. settlegrid-federal-register — Federal Register (no key)
194. settlegrid-cfr — Code of Federal Regulations (no key)
195. settlegrid-usc — US Code (no key)
196. settlegrid-congress-bills — Congressional bills (free key)
197. settlegrid-eu-legislation — EUR-Lex data (no key)
198. settlegrid-uk-legislation — UK legislation (no key)
199. settlegrid-sanctions-lists — Global sanctions data (no key)
200. settlegrid-ofac — OFAC SDN list (no key)
201. settlegrid-eu-sanctions — EU sanctions (no key)
202. settlegrid-un-sanctions — UN sanctions (no key)
203. settlegrid-pep-data — PEP databases (no key)
204. settlegrid-aml-data — AML/KYC reference data (no key)
205. settlegrid-gdpr-data — GDPR compliance info (no key)

### Infrastructure/Telecom (15)
206. settlegrid-internet-speed — Speed test data (no key)
207. settlegrid-downdetector — Service outage data (no key)
208. settlegrid-bgp-data — BGP routing data (no key)
209. settlegrid-dns-lookup — DNS resolution (no key)
210. settlegrid-ssl-check — SSL certificate check (no key)
211. settlegrid-port-check — Port availability (no key)
212. settlegrid-ping-check — Uptime monitoring (no key)
213. settlegrid-cdn-data — CDN performance data (no key)
214. settlegrid-cloud-pricing — Cloud provider pricing (no key)
215. settlegrid-aws-pricing — AWS service pricing (no key)
216. settlegrid-gcp-pricing — GCP service pricing (no key)
217. settlegrid-azure-pricing — Azure service pricing (no key)
218. settlegrid-data-center — Data center locations (no key)
219. settlegrid-submarine-cables — Undersea cable data (no key)
220. settlegrid-spectrum — Radio spectrum data (no key)

### Culture/Arts (15)
221. settlegrid-metropolitan — Met Museum art (no key)
222. settlegrid-rijksmuseum — Rijksmuseum art (free key)
223. settlegrid-artsy — Art/gallery data (free key)
224. settlegrid-europeana — European cultural data (free key)
225. settlegrid-smithsonian — Smithsonian collection (free key)
226. settlegrid-loc — Library of Congress (no key)
227. settlegrid-worldcat — Library catalog data (free key)
228. settlegrid-imslp — Sheet music data (no key)
229. settlegrid-color-api — Color palettes (no key)
230. settlegrid-design-quotes — Design quotes (no key)
231. settlegrid-art-institute — Art Institute Chicago (no key)
232. settlegrid-harvard-art — Harvard Art Museums (free key)
233. settlegrid-british-museum — British Museum data (no key)
234. settlegrid-font-data — Google Fonts metadata (no key)
235. settlegrid-icon-search — Icon search (no key)

### Remaining Long Tail (95)
236-330: Generate 95 more servers covering:
- Additional niche APIs from public-apis/public-apis categories not yet covered
- Regional weather services (Japan JMA, Australia BOM, India IMD)
- Additional blockchain explorers (Fantom, Gnosis, Moonbeam)
- Additional academic databases
- Additional sports (rugby, cricket, motorsport subdomains)
- Additional food/beverage APIs
- Additional utility APIs (unit conversion, random data, test data)
- Language/translation APIs beyond DeepL
- Music/audio APIs (Last.fm, AudioDB, Deezer)
- Photography/image APIs (Flickr, 500px)
- Travel APIs (country info, visa requirements, embassy data)
- Sustainability/ESG data APIs
- Cybersecurity threat feeds (free tiers)
- Machine-readable legal/regulatory APIs
- And any other free/public APIs you can find that have genuine utility

For these remaining 95, use your best judgment on which APIs provide the most value. Prioritize:
1. APIs that AI agents would actually call
2. APIs with stable, well-documented endpoints
3. APIs that don't require complex OAuth flows

## Quality Requirements

Same as Batch 1:
- 80-250 lines of TypeScript in src/server.ts
- Real API endpoints (actually fetchable URLs)
- settlegrid.init() with tool slug matching the directory name
- 2-3 methods per server with per-method pricing (1-5 cents)
- Input validation on all methods
- Error handling (API down, rate limited, invalid input)
- README with methods table, pricing, setup instructions
- "Powered by SettleGrid" and "Deploy to Vercel" in README
- MIT license

## Pricing Guidelines
- Simple lookups/reference data: 1¢/call
- Data requiring API key: 2¢/call
- AI-powered or compute-intensive: 3-5¢/call
- Batch operations: 1-2¢/item

Generate ALL 330 servers. Commit frequently (every 30-50 servers).
