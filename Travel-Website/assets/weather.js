/**
 * weather.js — shared climate-normals widget
 *
 * ⚠️ HOME: Travel Website/assets/weather.js — PERMANENT, lives next to toolbar.js.
 * Auto-loaded by toolbar.js on guide pages AND the Guides index (same loader
 * pattern the retired footnote.js used). Never add a <script src=".../weather.js">
 * tag to a page by hand — toolbar.js injects it.
 *
 * Two contexts, one component:
 *   · On a guide (Guides/City/file.html) — a 🌡 Climate button (bottom-right)
 *     locked to that city; the panel shows its typical high/low for any month.
 *   · On Guides/Guides-Index.html — the same 🌡 button, but the panel opens with
 *     a city PICKER, so any city's climate is reachable without opening a guide.
 * Both share: a 12-month range strip, a month selector, and a °C/°F toggle
 * (remembered across pages via localStorage).
 *
 * DATA IS BAKED IN (the CLIMATE object below) — no fetch, no network. This is
 * deliberate: the guides are opened both from the live site AND as local files
 * straight from Drive (file://), where a fetch() of a sibling .json is blocked
 * by the browser. Inlining the data makes the widget work everywhere.
 *
 * The data is climate NORMALS — avg daily high/low (°C), 12 values Jan..Dec per
 * guide folder. Not a forecast; these typical averages do not shift, which is
 * why they may live in the guide. Regenerate with Brain/scripts/build_climate.py
 * (it rewrites both Guides/climate.json and the CLIMATE block below, between the
 * CLIMATE_DATA markers).
 */
(function () {
  'use strict';

  /* ── Baked-in climate normals — keyed by guide folder name ──────────────── */
  /* CLIMATE_DATA_START */
  var CLIMATE = {"Abu Dhabi":{"city":"Abu Dhabi","hi":[24,25,28,33,36,39,40,40,39,35,30,26],"lo":[18,18,20,24,27,30,32,32,30,27,24,20]},"Aix-en-Provence":{"city":"Aix-en-Provence","hi":[10,13,16,18,22,28,32,31,26,21,14,11],"lo":[1,3,5,7,11,16,19,18,15,11,6,3]},"Alaska":{"city":"Alaska","hi":[-17,-13,-5,2,14,19,20,17,10,1,-9,-14],"lo":[-22,-20,-14,-8,3,10,12,9,3,-4,-15,-21]},"Alesund":{"city":"Alesund","hi":[4,4,6,9,11,17,17,17,14,10,6,3],"lo":[0,0,0,2,5,11,11,12,9,5,2,-1]},"Amalfi":{"city":"Amalfi","hi":[12,14,15,18,22,28,31,31,27,23,18,15],"lo":[5,6,7,10,14,19,22,22,19,15,12,8]},"Amsterdam":{"city":"Amsterdam","hi":[7,9,10,13,16,21,21,22,20,15,10,8],"lo":[3,3,3,5,8,13,14,15,12,10,5,3]},"Annecy":{"city":"Annecy","hi":[6,10,12,15,18,24,26,26,22,17,10,8],"lo":[0,1,3,5,9,14,16,16,13,9,4,2]},"Aruba":{"city":"Aruba","hi":[28,28,29,30,30,30,30,31,32,31,30,29],"lo":[25,25,25,26,26,26,26,27,27,27,26,26]},"Athens":{"city":"Athens","hi":[12,13,15,19,25,29,34,33,28,24,19,15],"lo":[5,6,7,10,16,20,23,23,20,15,12,8]},"Atlanta":{"city":"Atlanta","hi":[12,15,18,22,26,29,31,30,28,23,17,14],"lo":[3,5,8,10,16,19,22,21,18,13,6,4]},"Austin":{"city":"Austin","hi":[17,17,23,26,30,34,35,36,33,28,21,19],"lo":[6,6,12,15,20,23,25,26,23,17,11,8]},"Azores":{"city":"Azores","hi":[17,16,17,18,19,21,23,25,24,22,20,18],"lo":[14,13,13,14,15,17,19,20,20,18,16,14]},"Bali":{"city":"Bali","hi":[26,27,27,26,26,25,24,24,25,26,26,27],"lo":[21,21,21,21,21,20,19,19,20,20,21,21]},"Bangkok":{"city":"Bangkok","hi":[32,32,33,34,34,33,32,31,31,31,31,31],"lo":[22,24,26,27,27,26,26,25,25,24,24,22]},"Barbados":{"city":"Barbados","hi":[26,26,27,28,28,28,28,28,29,28,28,27],"lo":[22,22,22,22,24,24,24,24,24,24,23,23]},"Barcelona":{"city":"Barcelona","hi":[13,15,16,18,21,26,29,29,26,22,18,15],"lo":[4,6,8,10,14,19,22,22,18,15,10,6]},"Beijing":{"city":"Beijing","hi":[3,6,15,21,28,33,32,30,27,19,10,2],"lo":[-7,-5,1,8,14,20,22,21,17,8,0,-6]},"Bend":{"city":"Bend","hi":[6,5,7,13,17,23,29,28,23,16,9,5],"lo":[-2,-4,-3,1,5,9,12,13,9,4,0,-2]},"Bergen":{"city":"Bergen","hi":[3,4,6,10,12,18,17,18,15,10,6,3],"lo":[-1,-1,0,1,5,10,11,11,9,5,2,-2]},"Berlin":{"city":"Berlin","hi":[5,7,10,14,18,26,24,25,21,15,9,5],"lo":[0,0,1,4,8,15,15,16,12,8,4,0]},"Big Island":{"city":"Big Island","hi":[14,13,14,14,16,17,18,18,18,18,16,14],"lo":[5,4,6,6,7,8,8,8,8,8,7,6]},"Bologna":{"city":"Bologna","hi":[8,12,15,18,22,29,32,31,26,21,13,9],"lo":[1,3,5,8,13,18,20,20,16,12,7,3]},"Bordeaux":{"city":"Bordeaux","hi":[10,14,15,18,21,25,28,28,25,20,14,12],"lo":[3,5,6,8,12,16,17,17,15,12,7,6]},"Boston":{"city":"Boston","hi":[3,4,9,13,20,25,29,28,23,18,11,6],"lo":[-5,-5,-2,4,9,15,19,19,14,9,2,-2]},"Boulder":{"city":"Boulder","hi":[4,2,7,14,18,25,30,29,26,16,10,6],"lo":[-7,-11,-6,-1,5,12,15,15,11,2,-3,-5]},"Bruges":{"city":"Bruges","hi":[7,10,11,14,17,22,22,23,20,16,11,8],"lo":[3,3,4,5,8,13,14,15,13,10,6,4]},"Brussels":{"city":"Brussels","hi":[6,9,11,14,18,23,23,24,21,16,10,8],"lo":[2,3,4,5,8,13,14,15,12,10,5,3]},"Budapest":{"city":"Budapest","hi":[4,8,12,16,20,26,28,28,23,17,10,5],"lo":[-2,0,2,6,11,16,18,18,13,8,4,0]},"Buenos Aires":{"city":"Buenos Aires","hi":[28,27,25,21,18,15,14,16,18,21,25,27],"lo":[21,19,19,15,11,8,8,8,10,13,17,19]},"Cambridge":{"city":"Cambridge","hi":[7,10,11,14,17,21,22,23,20,16,11,8],"lo":[2,3,4,4,8,12,14,14,12,9,5,3]},"Cannes":{"city":"Cannes","hi":[12,14,16,17,21,26,29,30,26,22,17,14],"lo":[5,6,8,10,14,19,22,22,18,14,10,7]},"Capri":{"city":"Capri","hi":[13,13,13,15,18,23,26,26,25,21,18,15],"lo":[10,11,11,13,16,21,24,25,22,19,16,13]},"Carmel-by-the-Sea":{"city":"Carmel-by-the-Sea","hi":[14,14,14,14,15,17,17,18,19,19,17,14],"lo":[8,7,8,9,10,12,12,14,14,12,10,8]},"Cascais":{"city":"Cascais","hi":[15,16,17,17,20,20,22,22,23,21,18,16],"lo":[10,11,12,13,15,16,18,18,18,16,14,12]},"Cayman Islands":{"city":"Cayman Islands","hi":[28,28,28,29,30,30,31,31,31,30,29,28],"lo":[24,25,24,25,26,27,27,27,27,26,26,25]},"Charlotte":{"city":"Charlotte","hi":[11,14,18,22,26,30,32,31,28,23,16,13],"lo":[2,4,7,10,15,19,22,21,17,12,6,3]},"Chicago":{"city":"Chicago","hi":[0,1,8,13,19,25,27,27,24,16,9,5],"lo":[-6,-7,-1,4,10,16,19,19,16,8,1,-2]},"Chongqing":{"city":"Chongqing","hi":[11,14,19,23,26,29,32,34,28,22,18,12],"lo":[5,7,11,15,18,22,24,26,21,16,12,7]},"Cinque Terre":{"city":"Cinque Terre","hi":[12,13,15,17,20,26,28,29,25,21,16,13],"lo":[6,7,8,10,15,19,22,22,19,15,11,8]},"Colmar":{"city":"Colmar","hi":[6,10,12,15,18,25,26,25,22,17,10,7],"lo":[0,2,3,6,9,15,16,16,12,9,4,2]},"Columbia":{"city":"Columbia","hi":[14,17,20,24,28,31,33,32,30,25,18,15],"lo":[4,6,9,12,16,20,23,22,19,14,8,5]},"Copenhagen":{"city":"Copenhagen","hi":[5,6,7,10,14,20,20,21,18,13,8,5],"lo":[2,1,2,4,8,13,15,15,13,9,6,2]},"Corfu":{"city":"Corfu","hi":[13,14,15,18,22,28,32,32,27,23,19,15],"lo":[9,9,10,12,16,21,24,24,22,18,15,12]},"Curaçao":{"city":"Curaçao","hi":[29,29,29,30,31,31,31,32,32,31,30,29],"lo":[25,25,25,26,26,26,26,27,27,27,26,26]},"Cusco":{"city":"Cusco","hi":[16,16,16,16,17,17,18,18,18,19,18,17],"lo":[8,8,7,7,6,4,4,5,6,7,8,8]},"Dallas":{"city":"Dallas","hi":[14,14,20,24,28,32,35,36,32,26,19,16],"lo":[4,4,10,13,18,23,25,26,22,15,9,6]},"Denver":{"city":"Denver","hi":[5,4,10,16,21,28,32,31,28,18,12,7],"lo":[-9,-11,-6,0,6,12,16,16,11,2,-3,-6]},"Dubai":{"city":"Dubai","hi":[24,25,28,32,36,39,40,41,39,35,30,26],"lo":[15,16,19,22,25,28,31,30,28,24,21,18]},"Dublin":{"city":"Dublin","hi":[8,9,10,12,15,18,19,19,17,14,10,8],"lo":[3,4,4,5,8,10,12,12,11,8,6,4]},"Dubrovnik":{"city":"Dubrovnik","hi":[11,13,14,17,21,27,30,30,26,22,17,14],"lo":[3,4,6,9,14,19,21,22,18,13,10,7]},"Edinburgh":{"city":"Edinburgh","hi":[6,8,9,11,14,17,18,18,16,12,9,7],"lo":[2,3,3,4,7,10,12,12,10,8,5,3]},"Florence":{"city":"Florence","hi":[10,14,16,18,22,29,32,32,27,22,16,12],"lo":[2,3,4,7,12,16,19,19,16,12,8,5]},"Geneva":{"city":"Geneva","hi":[5,9,12,15,18,24,27,26,22,17,10,7],"lo":[0,1,3,5,10,15,17,17,14,9,4,1]},"Glasgow":{"city":"Glasgow","hi":[6,8,9,12,14,18,19,18,17,12,9,6],"lo":[2,2,2,3,6,10,12,12,10,7,4,2]},"Gothenburg":{"city":"Gothenburg","hi":[4,4,6,11,14,20,20,20,17,12,7,3],"lo":[0,-1,0,2,6,12,14,13,11,7,3,-1]},"Hamburg":{"city":"Hamburg","hi":[6,8,10,13,17,24,22,24,20,15,9,5],"lo":[2,1,2,3,8,13,14,15,12,9,4,2]},"Helsinki":{"city":"Helsinki","hi":[0,0,2,8,13,20,21,20,15,10,4,0],"lo":[-5,-5,-4,0,5,12,14,14,10,5,1,-4]},"Hong Kong":{"city":"Hong Kong","hi":[19,20,22,24,27,29,30,29,29,27,24,20],"lo":[13,14,18,20,24,26,26,26,25,22,19,13]},"Istanbul":{"city":"Istanbul","hi":[10,10,11,16,22,26,29,30,26,21,17,13],"lo":[4,4,5,8,13,18,20,21,18,14,10,7]},"Kauai":{"city":"Kauai","hi":[18,17,18,18,19,20,21,22,21,21,19,18],"lo":[10,10,11,11,12,14,14,14,14,14,13,12]},"Kyoto":{"city":"Kyoto","hi":[8,9,14,18,23,27,30,32,28,22,17,11],"lo":[-1,0,4,7,13,18,22,24,21,13,7,1]},"La Jolla":{"city":"La Jolla","hi":[18,18,17,19,20,22,24,26,26,24,21,18],"lo":[9,8,10,12,14,16,18,19,18,15,11,9]},"Lagos":{"city":"Lagos","hi":[16,18,19,20,25,26,29,30,27,24,20,18],"lo":[9,11,11,13,16,17,19,19,18,16,13,12]},"Lake Como":{"city":"Lake Como","hi":[9,12,14,17,21,26,28,28,23,19,13,9],"lo":[2,3,5,8,12,18,20,20,16,12,7,3]},"Las Vegas":{"city":"Las Vegas","hi":[14,16,20,27,32,38,41,40,36,28,20,14],"lo":[4,4,9,14,18,24,28,26,22,15,8,4]},"Lille":{"city":"Lille","hi":[7,10,12,14,18,22,23,24,21,16,11,8],"lo":[2,3,4,5,8,13,14,15,12,10,6,3]},"Lima":{"city":"Lima","hi":[24,25,25,23,21,20,19,18,18,19,20,22],"lo":[20,21,20,19,17,15,14,14,14,15,16,18]},"Lisbon":{"city":"Lisbon","hi":[14,17,18,19,24,25,28,28,26,23,18,16],"lo":[8,9,10,12,15,16,18,18,18,16,12,11]},"Ljubljana":{"city":"Ljubljana","hi":[5,10,12,15,19,26,28,27,22,18,10,6],"lo":[-3,-2,0,3,9,14,16,16,11,8,3,-1]},"London":{"city":"London","hi":[8,10,11,14,17,21,23,23,21,16,11,9],"lo":[2,3,4,4,8,12,14,14,12,9,5,4]},"Los Angeles":{"city":"Los Angeles","hi":[19,20,20,24,24,28,31,32,31,28,24,19],"lo":[8,7,9,12,13,15,17,18,18,15,11,8]},"Lucerne":{"city":"Lucerne","hi":[5,9,11,14,17,24,25,24,21,16,9,6],"lo":[0,0,2,4,8,14,16,16,13,9,4,1]},"Luxembourg":{"city":"Luxembourg","hi":[4,8,10,13,17,23,23,24,20,15,8,6],"lo":[0,1,2,4,8,13,14,14,11,8,4,2]},"Lyon":{"city":"Lyon","hi":[6,11,14,17,21,26,29,28,24,18,11,8],"lo":[0,2,4,6,11,16,17,17,14,10,5,2]},"MachuPicchu":{"city":"MachuPicchu","hi":[18,18,18,18,18,18,18,19,19,19,19,18],"lo":[12,12,11,11,10,9,9,9,10,11,12,12]},"Madeira":{"city":"Madeira","hi":[16,16,17,18,20,21,23,25,23,22,19,18],"lo":[11,11,12,12,14,15,17,18,17,16,14,13]},"Madrid":{"city":"Madrid","hi":[10,15,17,19,25,30,35,34,26,22,14,12],"lo":[1,3,5,8,12,16,20,20,15,11,6,4]},"Malibu":{"city":"Malibu","hi":[18,18,18,21,22,25,28,29,28,26,22,18],"lo":[11,10,10,12,14,16,18,19,19,16,13,11]},"Marktoberdorf":{"city":"Marktoberdorf","hi":[3,7,9,12,15,22,22,22,18,15,8,5],"lo":[-4,-2,-1,2,6,12,13,12,9,6,0,-2]},"Marrakech":{"city":"Marrakech","hi":[20,23,24,26,32,33,39,38,33,30,24,21],"lo":[5,8,10,12,16,18,22,22,19,15,10,7]},"Marseille":{"city":"Marseille","hi":[11,13,15,17,20,25,28,28,25,20,15,13],"lo":[5,6,8,9,13,18,21,20,18,14,10,7]},"Maui":{"city":"Maui","hi":[22,21,22,23,24,25,27,27,27,26,25,23],"lo":[16,15,16,16,17,18,19,19,19,19,18,17]},"Melbourne":{"city":"Melbourne","hi":[27,25,23,20,16,14,13,14,17,19,21,24],"lo":[15,14,14,10,8,7,6,7,8,9,11,12]},"Miami":{"city":"Miami","hi":[24,26,27,28,29,30,31,31,30,29,27,25],"lo":[17,20,20,22,23,24,26,26,25,24,21,19]},"Milan":{"city":"Milan","hi":[8,12,15,18,22,28,30,30,25,19,12,8],"lo":[0,2,4,8,13,18,20,20,16,12,6,2]},"Monaco":{"city":"Monaco","hi":[11,13,15,16,20,25,28,28,25,20,16,12],"lo":[4,5,7,9,13,18,21,21,17,13,8,6]},"Montevideo":{"city":"Montevideo","hi":[27,26,25,22,18,15,14,15,16,19,23,25],"lo":[20,19,18,15,12,10,9,9,10,13,16,18]},"Montreal":{"city":"Montreal","hi":[-5,-3,4,11,19,24,27,25,21,15,6,1],"lo":[-13,-13,-6,1,8,14,18,17,13,7,-1,-6]},"Munich":{"city":"Munich","hi":[4,8,10,14,17,23,24,24,20,16,8,6],"lo":[-2,-1,0,3,7,13,14,14,10,7,2,-1]},"Mykonos":{"city":"Mykonos","hi":[14,14,15,18,22,26,28,28,26,23,20,16],"lo":[10,10,11,14,17,21,24,24,22,19,16,13]},"Napa":{"city":"Napa","hi":[15,16,17,21,24,28,30,31,29,26,19,14],"lo":[5,4,6,8,10,13,13,14,14,11,6,5]},"Naples":{"city":"Naples","hi":[12,14,15,17,21,27,30,30,27,22,18,15],"lo":[5,6,7,9,13,18,21,21,19,14,11,8]},"Nashville":{"city":"Nashville","hi":[10,12,16,20,26,30,32,30,28,22,15,12],"lo":[0,2,5,8,15,19,22,21,18,12,4,3]},"New Orleans":{"city":"New Orleans","hi":[17,19,22,25,28,31,31,31,30,26,20,18],"lo":[9,11,14,17,21,24,25,26,24,19,13,12]},"New York":{"city":"New York","hi":[5,6,10,16,21,26,30,28,25,19,12,7],"lo":[-3,-2,1,6,11,17,21,20,16,11,4,0]},"Nice":{"city":"Nice","hi":[13,14,16,17,21,26,28,29,26,21,17,14],"lo":[5,6,8,10,14,19,22,21,18,14,10,7]},"Oahu":{"city":"Oahu","hi":[26,25,26,27,28,29,29,30,30,29,28,26],"lo":[21,20,21,22,22,24,24,24,24,24,23,22]},"Orlando":{"city":"Orlando","hi":[21,25,27,28,31,31,31,32,30,28,24,22],"lo":[11,14,16,18,20,23,24,24,23,20,16,13]},"Oslo":{"city":"Oslo","hi":[1,3,6,11,15,22,21,21,17,10,5,0],"lo":[-4,-3,-2,2,6,13,14,13,10,5,1,-4]},"Oxford":{"city":"Oxford","hi":[7,10,11,14,16,20,22,22,20,15,11,8],"lo":[2,3,4,4,8,11,13,14,11,9,5,3]},"Palm Desert":{"city":"Palm Desert","hi":[19,20,23,30,34,39,42,41,38,31,25,19],"lo":[11,10,12,17,20,25,29,29,25,19,14,11]},"Palo Alto":{"city":"Palo Alto","hi":[15,15,16,20,23,26,27,29,27,24,18,14],"lo":[7,6,7,9,11,14,14,16,15,12,9,7]},"Paris":{"city":"Paris","hi":[7,10,12,16,19,24,26,25,23,17,11,8],"lo":[2,3,4,6,9,14,15,15,13,10,6,4]},"Pasadena":{"city":"Pasadena","hi":[18,19,19,23,24,28,32,32,31,28,23,18],"lo":[7,7,8,10,12,14,17,18,18,14,11,8]},"Philadelphia":{"city":"Philadelphia","hi":[6,8,12,18,22,28,31,30,26,20,13,8],"lo":[-2,-2,2,7,12,17,21,20,16,11,3,0]},"Phoenix":{"city":"Phoenix","hi":[18,20,24,31,34,40,41,40,38,32,25,18],"lo":[6,6,10,15,20,25,29,28,25,17,11,6]},"Phuket":{"city":"Phuket","hi":[30,32,32,32,30,30,30,30,29,29,29,29],"lo":[24,25,25,26,26,25,25,25,25,24,24,24]},"Pisa":{"city":"Pisa","hi":[11,14,16,18,22,28,31,31,27,22,16,12],"lo":[2,4,5,7,12,17,20,20,16,13,8,5]},"Portland":{"city":"Portland","hi":[8,8,11,15,19,24,28,29,24,17,11,8],"lo":[3,1,2,5,9,12,15,15,13,8,4,2]},"Porto":{"city":"Porto","hi":[13,16,16,17,21,21,24,24,23,20,16,14],"lo":[7,8,9,10,13,14,16,16,16,14,11,9]},"Prague":{"city":"Prague","hi":[4,7,10,14,18,25,26,25,21,16,8,5],"lo":[-1,-1,1,4,8,14,15,15,11,7,2,0]},"Puerto Rico":{"city":"Puerto Rico","hi":[28,28,29,30,32,32,31,31,31,30,30,28],"lo":[22,22,22,22,24,25,25,25,25,24,24,23]},"Quebec City":{"city":"Quebec City","hi":[-6,-5,2,8,18,22,25,24,20,13,4,-1],"lo":[-14,-14,-8,-1,6,12,16,15,11,5,-3,-9]},"Queenstown":{"city":"Queenstown","hi":[22,21,19,15,12,8,7,8,11,14,18,19],"lo":[12,12,11,8,6,3,2,2,4,6,9,10]},"Reykjavik":{"city":"Reykjavik","hi":[2,2,3,7,9,11,13,13,10,7,4,1],"lo":[-3,-2,-2,2,4,7,9,9,6,3,0,-3]},"Rio de Janeiro":{"city":"Rio de Janeiro","hi":[30,29,29,27,25,25,25,25,26,26,26,28],"lo":[24,24,23,22,20,19,18,18,20,21,21,22]},"Rome":{"city":"Rome","hi":[12,15,17,19,23,30,33,33,28,23,18,14],"lo":[3,5,6,8,13,18,21,21,18,14,10,6]},"Salzburg":{"city":"Salzburg","hi":[5,9,11,14,17,24,25,24,20,17,10,6],"lo":[-3,-1,0,3,8,13,15,14,11,7,2,-1]},"San Diego":{"city":"San Diego","hi":[17,17,17,19,20,22,24,25,25,24,21,18],"lo":[8,8,10,12,14,16,18,19,18,15,11,9]},"San Francisco":{"city":"San Francisco","hi":[13,14,14,15,16,18,18,20,20,20,16,13],"lo":[8,8,9,10,11,13,13,15,15,13,10,8]},"San Jose":{"city":"San Jose","hi":[15,16,17,21,24,28,29,30,28,25,19,15],"lo":[6,6,7,9,12,14,15,16,15,13,8,7]},"San Juan Island":{"city":"San Juan Island","hi":[7,6,9,11,15,18,20,20,18,13,9,7],"lo":[4,2,4,6,9,11,13,14,12,8,5,3]},"San Sebastian":{"city":"San Sebastian","hi":[11,15,16,17,19,22,24,25,24,21,16,14],"lo":[6,7,8,9,12,15,17,17,16,14,10,8]},"Santa Barbara":{"city":"Santa Barbara","hi":[18,18,18,22,22,25,28,29,28,26,22,18],"lo":[8,8,9,12,13,16,18,19,18,15,11,9]},"Santa Cruz":{"city":"Santa Cruz","hi":[15,16,16,19,20,23,24,25,26,23,19,15],"lo":[8,6,7,9,10,12,13,15,14,12,9,8]},"Santa Monica":{"city":"Santa Monica","hi":[18,18,18,20,20,22,24,26,26,24,21,18],"lo":[8,8,10,12,14,16,18,18,18,15,11,8]},"Santiago":{"city":"Santiago","hi":[30,30,28,24,20,15,15,17,18,23,26,30],"lo":[15,15,14,12,10,7,7,8,8,10,12,14]},"Santorini":{"city":"Santorini","hi":[15,15,16,19,23,27,30,30,27,24,21,17],"lo":[11,11,12,14,18,22,24,24,23,20,17,14]},"Scottsdale":{"city":"Scottsdale","hi":[18,20,23,31,34,40,41,40,38,31,25,18],"lo":[6,7,10,16,20,26,30,28,25,18,12,8]},"Seattle":{"city":"Seattle","hi":[8,7,10,13,18,21,24,25,21,15,10,8],"lo":[3,2,3,6,9,12,15,15,13,9,5,3]},"Seoul":{"city":"Seoul","hi":[2,5,12,17,22,26,29,28,25,18,11,3],"lo":[-7,-5,0,6,12,18,22,22,17,9,2,-6]},"Seville":{"city":"Seville","hi":[16,20,21,23,30,32,38,37,31,27,20,17],"lo":[6,9,10,12,16,19,22,22,19,16,11,9]},"Shanghai":{"city":"Shanghai","hi":[10,11,16,20,25,28,31,32,28,23,18,11],"lo":[2,3,7,11,16,21,25,25,21,16,10,3]},"Siena":{"city":"Siena","hi":[10,13,15,18,22,29,32,32,27,21,15,11],"lo":[2,3,4,6,11,16,19,19,15,11,7,4]},"Singapore":{"city":"Singapore","hi":[29,30,31,30,30,29,29,29,30,30,29,29],"lo":[24,24,24,24,25,25,25,25,25,24,24,24]},"Sint Maarten":{"city":"Sint Maarten","hi":[26,26,26,26,27,28,28,28,29,28,28,27],"lo":[24,24,24,25,26,26,26,27,27,27,26,25]},"Sintra":{"city":"Sintra","hi":[14,16,17,17,20,20,23,23,23,21,17,16],"lo":[8,10,10,12,14,16,17,17,17,16,12,11]},"Sorrento":{"city":"Sorrento","hi":[12,14,15,17,21,27,30,30,27,22,18,15],"lo":[6,7,8,10,14,19,22,22,20,16,12,9]},"Split":{"city":"Split","hi":[11,13,15,17,22,28,31,31,27,22,17,13],"lo":[4,5,6,9,14,19,22,22,18,14,11,7]},"Stockholm":{"city":"Stockholm","hi":[2,3,6,10,15,22,22,21,16,11,6,1],"lo":[-3,-3,-2,0,5,12,13,13,9,5,2,-3]},"Strasbourg":{"city":"Strasbourg","hi":[6,10,12,16,20,26,26,26,22,17,10,7],"lo":[0,2,3,5,10,15,16,16,12,9,4,2]},"Stuttgart":{"city":"Stuttgart","hi":[5,9,11,14,18,24,25,24,21,16,9,6],"lo":[0,1,2,4,8,14,15,15,12,8,3,1]},"Sydney":{"city":"Sydney","hi":[26,26,24,22,19,17,17,18,21,23,23,25],"lo":[19,19,18,14,11,8,8,8,10,13,15,17]},"Taipei":{"city":"Taipei","hi":[19,21,23,25,29,31,34,33,30,27,25,20],"lo":[14,15,16,18,22,24,26,26,24,22,19,15]},"Tallinn":{"city":"Tallinn","hi":[0,1,4,9,14,22,21,21,16,10,4,0],"lo":[-4,-4,-2,1,5,12,14,14,10,6,1,-4]},"The Bahamas":{"city":"The Bahamas","hi":[25,26,26,27,28,29,31,31,30,29,27,26],"lo":[21,22,22,23,24,26,27,27,27,26,24,22]},"Tokyo":{"city":"Tokyo","hi":[9,11,15,18,23,26,30,32,28,22,18,12],"lo":[0,1,6,9,14,19,23,24,21,14,8,2]},"Toledo":{"city":"Toledo","hi":[10,15,17,19,26,30,35,34,27,22,15,12],"lo":[2,4,6,8,13,17,21,21,16,12,7,5]},"Toronto":{"city":"Toronto","hi":[0,1,5,11,17,23,26,26,22,15,8,4],"lo":[-7,-8,-3,2,8,14,18,17,14,8,1,-2]},"Tromso":{"city":"Tromso","hi":[-3,-2,-1,3,7,14,17,16,10,4,0,-3],"lo":[-7,-6,-5,-2,1,8,10,10,6,0,-4,-7]},"Turin":{"city":"Turin","hi":[8,12,15,18,22,28,31,30,25,19,12,7],"lo":[-2,0,3,7,11,17,19,18,15,10,3,-1]},"Turks and Caicos":{"city":"Turks and Caicos","hi":[26,25,25,26,27,28,29,29,29,29,28,26],"lo":[24,24,24,25,26,27,27,28,27,27,26,25]},"Vancouver":{"city":"Vancouver","hi":[6,5,9,11,16,19,22,22,19,13,8,6],"lo":[2,0,2,5,9,12,15,15,13,8,4,1]},"Venice":{"city":"Venice","hi":[8,10,13,16,20,26,28,28,24,19,13,9],"lo":[1,2,5,8,14,19,21,21,17,12,7,3]},"Verona":{"city":"Verona","hi":[8,12,15,18,22,28,31,30,25,20,13,9],"lo":[0,2,4,8,13,18,20,20,16,11,6,2]},"Vienna":{"city":"Vienna","hi":[4,8,12,15,19,26,27,26,22,16,10,5],"lo":[-1,1,2,5,10,16,17,17,13,8,3,0]},"Virgin Islands":{"city":"Virgin Islands","hi":[26,25,25,26,27,27,28,28,28,28,27,26],"lo":[24,24,24,24,25,26,26,26,26,26,26,25]},"Washington DC":{"city":"Washington DC","hi":[7,9,14,19,23,29,32,30,26,20,13,9],"lo":[-2,0,3,8,12,18,21,20,17,11,4,1]},"Wellington":{"city":"Wellington","hi":[20,20,18,17,16,14,13,12,13,15,17,18],"lo":[15,15,14,13,12,10,9,9,9,10,12,14]},"Whistler":{"city":"Whistler","hi":[2,1,5,8,16,19,23,23,18,12,5,1],"lo":[-3,-6,-3,0,4,8,12,12,9,4,-2,-4]},"Zhangjiajie":{"city":"Zhangjiajie","hi":[8,11,17,20,24,28,30,31,27,21,16,10],"lo":[2,4,9,13,17,22,24,24,21,14,10,4]},"Zurich":{"city":"Zurich","hi":[4,8,11,14,18,24,25,24,21,16,8,5],"lo":[-2,0,1,4,8,14,15,15,12,8,3,0]}};
  /* CLIMATE_DATA_END */

  /* Expose the baked climate normals on a global so OTHER pages can reuse the
     exact same data without a second copy. The full-page Climate Finder
     (Trip-Essentials/Climate Finder.html) loads weather.js purely for this —
     weather.js renders no UI off the Guides index (the guard just below). This
     runs before the guard so the data is set wherever weather.js is loaded. */
  try { window.TravelClimate = CLIMATE; } catch (e) {}

  /* Index only — the Weather control is NOT shown on individual guide pages. */
  var isIndex = /guides_index\.html?$/.test(location.pathname);
  if (!isIndex) return;

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var MONTHS_LONG = ['January','February','March','April','May','June','July',
                     'August','September','October','November','December'];

  /* Palette — matches guide-style.css / toolbar.js */
  var GOLD = '#8a6c1a', WARM = '#fdf8f0', BORDER = '#c4b896',
      INK = '#3d3a32', MUTE = '#6b6860', PAGEBORDER = '#d8d5ce';

  function unit() {
    try { return localStorage.getItem('guideTempUnit') === 'F' ? 'F' : 'C'; }
    catch (e) { return 'C'; }
  }
  function setUnit(u) { try { localStorage.setItem('guideTempUnit', u); } catch (e) {} }
  function conv(c) { return unit() === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c); }

  build(CLIMATE, null);

  function build(db, fixedKey) {
    /* Sorted list of cities that actually have data (index picker). */
    var cityKeys = Object.keys(db).filter(function (k) {
      return db[k] && db[k].hi;
    }).sort(function (a, b) {
      return (db[a].city || a).localeCompare(db[b].city || b);
    });

    var curKey = fixedKey;                 // null on index until a city is picked
    var selMonth = new Date().getMonth();

    /* ── Find-places (reverse search) state ──────────────────────────────────
       mode 'city' = pick a city, see its months (original behaviour).
       mode 'find' = pick a month + a daytime-high band, list every city whose
       typical high for that month falls inside the band. Band is stored in °C
       so the °C/°F toggle never corrupts it. */
    var mode = 'city';
    var fMonth = new Date().getMonth();
    var fMinC = 18, fMaxC = 27;

    /* ── Weather launcher — just the word, no button. Plain clickable text
       placed inline in the index topbar, next to the search box. ─────────── */
    var fab = document.createElement('span');
    fab.setAttribute('role', 'button');
    fab.setAttribute('tabindex', '0');
    fab.setAttribute('aria-label', 'Weather — typical high/low by month');
    /* Inline SVG thermometer in currentColor (white on the banner — the emoji
       was too low-contrast against the banner background). */
    fab.innerHTML = '🌡 Weather';
    fab.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });

    /* Weather button is a permanent toolbar item on all pages (added via toolbar.js
       ITEMS). On the guides index, weather.js intercepts its click to open the panel
       instead of navigating. On other pages it navigates to guides_index normally. */
    function wireWeatherButton() {
      var links = document.querySelectorAll('.tb a');
      for (var i = 0; i < links.length; i++) {
        if (links[i].textContent.indexOf('Weather') !== -1) {
          links[i].addEventListener('click', function (e) {
            e.preventDefault();
            open();
          });
          return true;
        }
      }
      return false;
    }

    if (!wireWeatherButton()) {
      /* Toolbar not yet in DOM — wait for it */
      document.addEventListener('DOMContentLoaded', wireWeatherButton);
    }

    /* ── Per-guide hover — trip snapshot when you hover a card ─────────────
       Shows: days planned · flight time · cost tier · safety level.
       Data sourced from window globals set by Guides-Index.html. */
    var GUIDE_DAYS = {
      'Abu Dhabi':2,'Aix-en-Provence':2,'Alaska':5,'Alesund':5,'Amalfi':2,
      'Amsterdam':5,'Annecy':3,'Aruba':2,'Athens':3,'Atlanta':2,'Austin':2,
      'Azores':2,'Bahamas':2,'Bangkok':2,'Barbados':2,'Barcelona':5,'Beijing':4,
      'Bend':3,'Bergen':3,'Berlin':5,'Big Island':2,'Bologna':2,'Bordeaux':2,
      'Boston':2,'Bruges':2,'Brussels':3,'Buenos Aires':2,'Cambridge':3,'Cannes':2,
      'Capri':2,'Cascais':3,'Cayman Islands':2,'Chicago':2,'Chongqing':2,
      'Cinque Terre':2,'Colmar':2,'Copenhagen':6,'Corfu':2,'Curacao':2,'Cusco':2,
      'Dubai':2,'Dublin':6,'Dubrovnik':3,'Edinburgh':5,'Florence':3,'Geneva':2,
      'Glasgow':3,'Gothenburg':2,'Helsinki':5,'Hong Kong':2,'Reykjavik':8,'Istanbul':3,'Kauai':2,
      'Kyoto':4,'Lagos':2,'Lake Como':2,'Lille':2,'Lima':2,'Lisbon':8,
      'Ljubljana':2,'London':6,'Los Angeles':2,'Lucerne':2,'Luxembourg':2,'Lyon':2,
      'MachuPicchu':2,'Madeira':1,'Madrid':5,'Marktoberdorf':7,'Marrakech':10,
      'Marseille':2,'Maui':2,'Melbourne':2,'Miami':2,'Milan':3,'Monaco':2,
      'Montevideo':5,'Montreal':4,'Munich':7,'Naples':1,'New York':5,'Nice':2,
      'Oahu':3,'Orlando':2,'Oslo':5,'Oxford':2,'Palm Desert':7,'Palo Alto':7,
      'Paris':6,'Pasadena':7,'Phuket':2,'Pisa':2,'Porto':3,'Prague':3,
      'Puerto Rico':2,'Quebec City':2,'Queenstown':2,'Rio de Janeiro':3,'Rome':3,
      'Salzburg':2,'San Diego':6,'San Francisco':4,'San Sebastian':2,'Santiago':3,
      'Scottsdale':2,'Seattle':2,'Seoul':4,'Seville':1,'Shanghai':4,'Siena':2,
      'Singapore':8,'Sint Maarten':2,'Sintra':2,'Sorrento':2,'Split':3,
      'Stockholm':2,'Strasbourg':2,'Stuttgart':2,'Sydney':8,'Taipei':2,'Tallinn':2,
      'Tokyo':6,'Toledo':2,'Toronto':2,'Tromso':5,'Turin':5,'Vancouver':5,'Venice':2,'Verona':3,'Vienna':6,
      'Virgin Islands':2,'Wellington':2,'Zhangjiajie':2,'Zurich':10
    };
    var COST_SYM = {'Budget':'$','Mid-range':'$$','Expensive':'$$$','Very Expensive':'$$$$','Premium':'$$$$'};

    function attachCardHovers() {
      var cards = document.querySelectorAll('.dest-card');
      if (!cards.length) return false;
      var tip = document.createElement('div');
      tip.style.cssText =
        'position:fixed;z-index:1100;display:none;pointer-events:none;' +
        'background:' + WARM + ';border:1px solid ' + BORDER + ';border-radius:9px;' +
        'padding:8px 11px;box-shadow:0 4px 18px rgba(0,0,0,.20);' +
        'font-family:inherit;color:' + INK + ';font-size:12px;min-width:140px;';
      document.body.appendChild(tip);

      function content(folder, cityLabel) {
        var days   = GUIDE_DAYS[folder];
        var fmap   = window._FMAP || {};
        var costD  = (window._COST_DATA   || {})[cityLabel] || (window._COST_DATA   || {})[folder] || {};
        var safeD  = (window._SAFETY_DATA || {})[cityLabel] || (window._SAFETY_DATA || {})[folder] || {};

        /* Flight: find FMAP key whose first segment matches folder */
        var flightMins = null;
        Object.keys(fmap).forEach(function (k) {
          if (k.split('/')[0] === folder && fmap[k].r !== 'home' && fmap[k].m)
            flightMins = fmap[k].m;
        });

        var line1 = [];
        if (days) line1.push('📅 ' + days + ' day' + (days > 1 ? 's' : ''));
        if (flightMins) line1.push('✈️ ' + Math.round(flightMins / 60) + 'h');

        var line2 = [];
        if (costD.tier)  line2.push('💰 ' + (COST_SYM[costD.tier] || costD.tier));
        if (safeD.level) line2.push('🛡 ' + safeD.level);

        return '<div style="font-weight:700;color:' + GOLD + ';margin-bottom:4px;">' + cityLabel + '</div>' +
          (line1.length ? '<div style="margin-bottom:2px;">' + line1.join(' · ') + '</div>' : '') +
          (line2.length ? '<div style="font-size:11px;color:' + MUTE + ';">' + line2.join(' · ') + '</div>' : '');
      }
      function position(e) {
        var pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
        var x = e.clientX + pad, y = e.clientY + pad;
        if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
        if (y + h > window.innerHeight - 8) y = e.clientY - h - pad;
        tip.style.left = Math.max(8, x) + 'px';
        tip.style.top = Math.max(8, y) + 'px';
      }
      [].forEach.call(cards, function (card) {
        var href = card.getAttribute('href') || '';
        var folder = decodeURIComponent((href.replace(/^\.\//, '').split('/')[0]) || '');
        var nameEl = card.querySelector('.dest-name');
        var cityLabel = nameEl ? nameEl.textContent.trim() : folder;
        if (!folder) return;
        card.addEventListener('mouseenter', function (e) { tip.innerHTML = content(folder, cityLabel); tip.style.display = 'block'; position(e); });
        card.addEventListener('mousemove', position);
        card.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
      });
      return true;
    }
    if (!attachCardHovers() && document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachCardHovers);
    }

    /* ── Backdrop + panel ────────────────────────────────────────────────── */
    var backdrop = document.createElement('div');
    backdrop.style.cssText =
      'position:fixed;inset:0;z-index:1000;background:rgba(40,38,32,.38);' +
      'display:none;align-items:center;justify-content:center;padding:16px;';

    var panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Climate');
    panel.style.cssText =
      'background:' + WARM + ';border:1px solid ' + BORDER + ';border-radius:14px;' +
      'width:100%;max-width:380px;max-height:90vh;overflow-y:auto;' +
      'box-shadow:0 10px 40px rgba(0,0,0,.28);' +
      'font-family:inherit;color:' + INK + ';position:relative;';
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    /* °C/°F segmented toggle — shared by every header. */
    function unitToggle() {
      var u = unit();
      return '<div style="display:inline-flex;border:1px solid ' + BORDER + ';border-radius:7px;overflow:hidden;flex-shrink:0;">' +
          '<button type="button" class="wx-unit" data-u="C" style="border:none;cursor:pointer;padding:6px 11px;font-size:13px;font-weight:600;' +
            'background:' + (u === 'C' ? GOLD : 'transparent') + ';color:' + (u === 'C' ? '#fff' : MUTE) + ';">°C</button>' +
          '<button type="button" class="wx-unit" data-u="F" style="border:none;cursor:pointer;padding:6px 11px;font-size:13px;font-weight:600;' +
            'background:' + (u === 'F' ? GOLD : 'transparent') + ';color:' + (u === 'F' ? '#fff' : MUTE) + ';">°F</button>' +
        '</div>';
    }

    /* Segmented control to switch between the two modes. */
    function modeToggle() {
      function tab(m, label) {
        var on = (mode === m);
        return '<button type="button" class="wx-mode" data-m="' + m + '" style="flex:1;border:none;cursor:pointer;' +
          'padding:7px 0;font-size:13px;font-weight:600;border-radius:7px;' +
          'background:' + (on ? GOLD : 'transparent') + ';color:' + (on ? '#fff' : MUTE) + ';">' + label + '</button>';
      }
      return '<div style="display:flex;gap:4px;background:#fff;border:1px solid ' + BORDER + ';' +
        'border-radius:9px;padding:3px;margin-bottom:14px;">' + tab('city', 'By city') + tab('find', 'Find places') + '</div>';
    }

    function header() {
      var u = unit();
      var toggle = unitToggle();

      if (isIndex) {
        var opts = '<option value="" ' + (curKey ? '' : 'selected') + '>Pick a city…</option>' +
          cityKeys.map(function (k) {
            return '<option value="' + k + '"' + (k === curKey ? ' selected' : '') + '>' +
              (db[k].city || k) + '</option>';
          }).join('');
        return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTE + ';margin-bottom:4px;">Typical Weather</div>' +
              '<select class="wx-city" style="width:100%;max-width:230px;font-size:15px;font-weight:600;color:' + GOLD + ';' +
                'padding:6px 8px;border:1px solid ' + BORDER + ';border-radius:7px;background:#fff;cursor:pointer;">' + opts + '</select>' +
            '</div>' + toggle +
          '</div>';
      }
      return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">' +
          '<div>' +
            '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTE + ';">Typical Weather</div>' +
            '<div style="font-size:20px;font-weight:700;color:' + GOLD + ';line-height:1.2;">' + (db[curKey].city || curKey) + '</div>' +
          '</div>' + toggle +
        '</div>';
    }

    function body() {
      if (!curKey) {
        return '<div style="margin-top:22px;margin-bottom:12px;text-align:center;font-size:14px;color:' + MUTE + ';line-height:1.5;">' +
          'Choose a city above to see its<br>typical high and low for any month.</div>';
      }
      var rec = db[curKey];
      var hiC = rec.hi[selMonth], loC = rec.lo[selMonth];
      var hi = (hiC == null) ? '–' : conv(hiC) + '°' + unit();
      var lo = (loC == null) ? '–' : conv(loC) + '°' + unit();

      var vals = [];
      for (var i = 0; i < 12; i++) {
        if (rec.hi[i] != null) vals.push(rec.hi[i]);
        if (rec.lo[i] != null) vals.push(rec.lo[i]);
      }
      var lo0 = Math.min.apply(null, vals), hi0 = Math.max.apply(null, vals);
      var span = (hi0 - lo0) || 1, H = 86, bars = '';
      for (var j = 0; j < 12; j++) {
        var sel = (j === selMonth);
        if (rec.hi[j] == null) { bars += '<div style="flex:1"></div>'; continue; }
        var top = (1 - (rec.hi[j] - lo0) / span) * H;
        var bot = (1 - (rec.lo[j] - lo0) / span) * H;
        var barH = Math.max(3, bot - top);
        bars +=
          '<div class="wx-col" data-mon="' + j + '" style="flex:1;display:flex;flex-direction:column;' +
            'align-items:center;cursor:pointer;min-width:0;">' +
            '<div style="position:relative;height:' + H + 'px;width:100%;display:flex;justify-content:center;">' +
              '<div style="position:absolute;top:' + top + 'px;height:' + barH + 'px;width:7px;border-radius:4px;' +
                'background:' + (sel ? GOLD : 'rgba(138,108,26,.30)') + ';"></div>' +
            '</div>' +
            '<div style="font-size:9px;margin-top:4px;color:' + (sel ? GOLD : MUTE) + ';' +
              'font-weight:' + (sel ? '700' : '400') + ';">' + MONTHS[j][0] + '</div>' +
          '</div>';
      }

      return '<div style="margin-top:16px;text-align:center;font-size:13px;color:' + MUTE + ';">' + MONTHS_LONG[selMonth] + '</div>' +
        '<div style="display:flex;justify-content:center;gap:28px;margin-top:6px;">' +
          '<div style="text-align:center;">' +
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#a61c00;">High</div>' +
            '<div style="font-size:34px;font-weight:700;color:#a61c00;line-height:1.1;">' + hi + '</div>' +
          '</div>' +
          '<div style="width:1px;background:' + PAGEBORDER + ';"></div>' +
          '<div style="text-align:center;">' +
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#3d5282;">Low</div>' +
            '<div style="font-size:34px;font-weight:700;color:#3d5282;line-height:1.1;">' + lo + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:18px;display:flex;align-items:flex-end;gap:2px;">' + bars + '</div>' +
        '<div style="margin-top:6px;font-size:10px;text-align:center;color:' + MUTE + ';">Tap a month · avg daily high/low</div>' +
        '<div style="margin-top:14px;display:grid;grid-template-columns:repeat(6,1fr);gap:5px;">' +
          MONTHS.map(function (mo, k) {
            var s = (k === selMonth);
            return '<button type="button" class="wx-mon" data-mon="' + k + '" style="border:1px solid ' +
              (s ? GOLD : BORDER) + ';border-radius:6px;cursor:pointer;padding:7px 0;font-size:12px;' +
              'background:' + (s ? GOLD : '#fff') + ';color:' + (s ? '#fff' : INK) + ';' +
              'font-weight:' + (s ? '600' : '400') + ';">' + mo + '</button>';
          }).join('') +
        '</div>';
    }

    /* ── Find mode — header (title + unit toggle) ────────────────────────── */
    function findHeader() {
      return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">' +
          '<div>' +
            '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTE + ';">Find Places</div>' +
            '<div style="font-size:20px;font-weight:700;color:' + GOLD + ';line-height:1.2;">By month &amp; temperature</div>' +
          '</div>' + unitToggle() +
        '</div>';
    }

    /* ── Find mode — month grid + temperature band + matching-city list ───── */
    function findBody() {
      var u = unit(), lo = conv(fMinC), hi = conv(fMaxC);

      var monGrid =
        '<div style="margin-top:16px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:' + MUTE + ';">Month</div>' +
        '<div style="margin-top:6px;display:grid;grid-template-columns:repeat(6,1fr);gap:5px;">' +
          MONTHS.map(function (mo, k) {
            var s = (k === fMonth);
            return '<button type="button" class="wx-fmon" data-mon="' + k + '" style="border:1px solid ' +
              (s ? GOLD : BORDER) + ';border-radius:6px;cursor:pointer;padding:7px 0;font-size:12px;' +
              'background:' + (s ? GOLD : '#fff') + ';color:' + (s ? '#fff' : INK) + ';' +
              'font-weight:' + (s ? '600' : '400') + ';">' + mo + '</button>';
          }).join('') +
        '</div>';

      var rangeRow =
        '<div style="margin-top:16px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:' + MUTE + ';">Typical daytime high</div>' +
        '<div style="margin-top:6px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;color:' + INK + ';">' +
          '<input type="number" class="wx-fmin" value="' + lo + '" style="width:60px;padding:7px;border:1px solid ' + BORDER + ';border-radius:6px;font-size:15px;text-align:center;">' +
          '<span style="color:' + MUTE + ';">to</span>' +
          '<input type="number" class="wx-fmax" value="' + hi + '" style="width:60px;padding:7px;border:1px solid ' + BORDER + ';border-radius:6px;font-size:15px;text-align:center;">' +
          '<span style="color:' + MUTE + ';font-weight:600;">°' + u + '</span>' +
        '</div>';

      var matchKeys = cityKeys.filter(function (k) {
        var v = db[k].hi[fMonth];
        return v != null && v >= fMinC && v <= fMaxC;
      }).sort(function (a, b) { return db[a].hi[fMonth] - db[b].hi[fMonth]; });

      var results;
      if (!matchKeys.length) {
        results = '<div style="margin-top:18px;text-align:center;font-size:13px;color:' + MUTE + ';line-height:1.5;">' +
          'No cities with a typical high of ' + lo + '–' + hi + '°' + u + ' in ' + MONTHS_LONG[fMonth] + '.<br>Try widening the range.</div>';
      } else {
        var rows = matchKeys.map(function (k) {
          var rec = db[k];
          return '<button type="button" class="wx-fhit" data-key="' + k + '" style="width:100%;text-align:left;' +
            'border:none;border-bottom:1px solid ' + PAGEBORDER + ';background:transparent;cursor:pointer;' +
            'padding:10px 4px;display:flex;justify-content:space-between;align-items:center;font-size:14px;color:' + INK + ';">' +
            '<span style="font-weight:600;">' + (rec.city || k) + '</span>' +
            '<span><span style="color:#a61c00;font-weight:700;">' + conv(rec.hi[fMonth]) + '°</span>' +
              '<span style="color:' + MUTE + ';"> / </span>' +
              '<span style="color:#3d5282;font-weight:700;">' + conv(rec.lo[fMonth]) + '°</span></span>' +
          '</button>';
        }).join('');
        results =
          '<div style="margin-top:18px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:' + MUTE + ';">' +
            matchKeys.length + ' place' + (matchKeys.length > 1 ? 's' : '') + ' · high ' + lo + '–' + hi + '°' + u + ' in ' + MONTHS_LONG[fMonth] + '</div>' +
          '<div style="margin-top:4px;max-height:230px;overflow-y:auto;">' + rows + '</div>' +
          '<div style="margin-top:8px;font-size:10px;text-align:center;color:' + MUTE + ';">Tap a place to see its full year</div>';
      }

      return monGrid + rangeRow + results;
    }

    function render() {
      var head = (mode === 'find') ? findHeader() : header();
      var bod  = (mode === 'find') ? findBody()   : body();
      panel.innerHTML =
        '<div style="padding:18px 20px 20px;">' + modeToggle() + head + bod +
          '<div style="margin-top:14px;text-align:center;">' +
            '<button type="button" class="wx-close" style="border:none;background:transparent;cursor:pointer;' +
              'color:' + MUTE + ';font-size:13px;text-decoration:underline;padding:4px 8px;">Close</button>' +
          '</div>' +
        '</div>';

      panel.querySelectorAll('.wx-mode').forEach(function (b) {
        b.addEventListener('click', function () {
          /* Desktop: the Find-places experience opens as a dedicated full page
             (more room for the results grid). Narrow screens use the inline
             find panel built below — a full page adds nothing on a phone. */
          if (b.dataset.m === 'find' &&
              window.matchMedia && window.matchMedia('(min-width: 760px)').matches) {
            location.href = '../Trip-Essentials/Climate%20Finder.html' +
              '?mon=' + fMonth + '&minc=' + Math.round(fMinC) +
              '&maxc=' + Math.round(fMaxC) + '&u=' + unit();
            return;
          }
          mode = b.dataset.m; render();
        });
      });
      panel.querySelectorAll('.wx-unit').forEach(function (b) {
        b.addEventListener('click', function () { setUnit(b.dataset.u); render(); });
      });
      var citySel = panel.querySelector('.wx-city');
      if (citySel) citySel.addEventListener('change', function () {
        curKey = citySel.value || null; selMonth = new Date().getMonth(); render();
      });
      panel.querySelectorAll('.wx-mon, .wx-col').forEach(function (b) {
        b.addEventListener('click', function () { selMonth = parseInt(b.dataset.mon, 10); render(); });
      });

      /* Find-mode controls */
      panel.querySelectorAll('.wx-fmon').forEach(function (b) {
        b.addEventListener('click', function () { fMonth = parseInt(b.dataset.mon, 10); render(); });
      });
      function readBand() {
        var minI = panel.querySelector('.wx-fmin'), maxI = panel.querySelector('.wx-fmax');
        if (!minI || !maxI) return;
        var toC = function (v) { return unit() === 'F' ? (v - 32) * 5 / 9 : v; };
        var a = toC(parseFloat(minI.value)), b = toC(parseFloat(maxI.value));
        if (isNaN(a) || isNaN(b)) return;
        fMinC = Math.min(a, b); fMaxC = Math.max(a, b);
        render();
      }
      panel.querySelectorAll('.wx-fmin, .wx-fmax').forEach(function (inp) {
        inp.addEventListener('change', readBand);
      });
      panel.querySelectorAll('.wx-fhit').forEach(function (b) {
        b.addEventListener('click', function () {
          mode = 'city'; curKey = b.dataset.key; selMonth = fMonth; render();
        });
      });

      panel.querySelector('.wx-close').addEventListener('click', close);
    }

    function open() { if (curKey) selMonth = new Date().getMonth(); render(); backdrop.style.display = 'flex'; }
    function close() { backdrop.style.display = 'none'; }

    fab.addEventListener('click', open);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
}());
