# MUUSIA Surface Composer arkkitehtuuri ja toteutussuunnitelma

Päiväys: 13.11.2026. Versio 2.185 tarkentaa mitattujen alku- ja katkaisuvarojen perusteella Epsonin päätylapun lisävaraksi noin 17 mm. Aiempi 2.184 lisäsi paperien reunakohtiin kulmakaaret ja asteet esikatselussa ja kokoamis-PDF:ssä. Aiempi 2.183 lisäsi Independent Content -tilan kaikille paperiperheille, Surface Context -solmun, kokoamis-PDF:n sekä valinnaiset päätylaput pienellä vasemman reunan kiinnikkeellä. Mittatarkat viennit ja yhden suikaleen tulostusoletus säilyvät. Versio 2.185 on julkaistu ja tarkistettu julkisessa Muusiassa 13.11.2026. Käyttäjä vahvisti lyhyen USB-testin päätylapun jääneen vasemmalta kiinni. Lapun leikkauksen jälkeinen 18 mm:n tekstiväli ja kuvan jälkeinen 2 mm:n loppuvara on nyt mitattu.

Surface Composer laajentaa Muusian nykyistä millimetripohjaista teospintaa. Mega Canvasin ja Roll Moden nykyiset arkit, vientimuodot ja projektit säilytetään. Uusi osa on fyysisten suikaleiden sijainti, rotaatio ja tulostusalue sekä yhteinen muunnos teospinnan ja suikaleen välillä. Sama muunnos ohjaa esikatselua ja vientiä.

## Katselmuksen lähtötilanne

Katselmus perustuu käyttäjän 12.11.2026 toimittamaan Surface Composer & Freeform Strips -ohjeeseen ja lähdekoodiin. Työhakemiston HEAD on `6f5c0dff60c65765b2ae340446eafabe339c3250`, ja paikallinen App.jsx ilmoittaa version 2.131. Työhakemistossa on runsaasti aiempia muutoksia. Haettu `origin/main` on `73118d335153e76fb051fc75f99eee44866c2ac7`, jonka App.jsx ilmoittaa version 2.177.

Toteutus on erillisessä `codex/surface-composer`-työhaarassa, hakemistossa `/private/tmp/muusia-surface-composer-20261112`, lähtökohtana `73118d335153e76fb051fc75f99eee44866c2ac7`. Vanhan ensisijaisen työhakemiston koko diffiä ei siirretty siihen. Alkuperäinen katselmus muutti vain dokumentaatiota; seuraava geometriavaihe lisäsi kaksi erillistä tiedostoa muuttamatta nykyisiä sovellus- ja vientipolkuja.

## Geometriaytimen toteutus

[surface-composer.js](../src/surface-composer.js) toteuttaa puhtaat millimetripohjaiset laskelmat ilman selainta, tulostinta tai graafin arviointia. Oletukset ovat edelleen alustava 80 mm paperi, 72 mm tulostusalue keskellä paperia ja 8 mm fyysinen rako. Tulostusalueen voi siirtää epäkeskiseksi.

| Rajapinta | Käyttö |
| --- | --- |
| `createStrip` | Validoitu, JSON-muodossa tallennettava suikale. Keskipiste, myötäpäiväinen kulma, paperin ja tulostusalueen mitat, pituus, näkyvyys sekä erilliset z- ja tulostusjärjestykset. |
| `stripTransform`, `stripCorners` | Yhteinen local/global-muunnos ja paperin tai tulostusalueen kulmat. Pisteiden mahdollinen syvyys säilyy. |
| `clipPathsToStrip` | Viivojen Image Mapping nykyisellä `cropTestPiece`-leikkurilla. Tulos pysyy koko paperin paikalliskoordinaateissa, joten tulostumaton reuna ei katoa. |
| `generateStripTiling` | Pysty-, vaaka- tai vapaakulmainen yhdensuuntainen asettelu. Automaattinen tai annettu määrä ja pituus. Numerot ja tunnisteet ovat deterministisiä. |
| `surfaceBounds`, `surfaceSummary` | Paperin todelliset ulkomitat ja kulutus millimetreinä/metreinä; piilotetut suikaleet jätetään oletuksena pois. |
| `hitTestStrip`, `stripsInPrintOrder` | Päällimmäisen näkyvän paperin valinta, myös tyhjältä reunalta, sekä siitä riippumaton vakaa tulostusjärjestys. |

Generoinnin muistiraja on 4096 suikaletta. Se ei ole fyysisen pituuden raja: tarkistuksessa toimii myös 100 metrin suikale. Tyhjällä asettelulla ulkomitta on `null` ja paperimäärä nolla. Virheelliset mitat, tulostusalue paperin ulkopuolella, ei-numeeriset pisteet ja päällekkäiset tunnisteet hylätään. `independent` hyväksytään tulevaa tietomallia varten, mutta tämän vaiheen sisältölaskenta toteuttaa vain viivojen Image Mappingin.

[validate-surface-composer.mjs](../tools/validate-surface-composer.mjs) sisältää 18 läpäissyttä testiä, mukaan lukien 200 deterministisesti valittua edestakaista koordinaattimuunnosta, analyyttiset 45 asteen leikkauspisteet, jatkuvat ympyrät, suljetut polut, syvyys, huoltomerkinnät, materiaalimäärät, paperin päällekkäisyys ja virhetilanteet. Myös nykyiset Preview Crop-, Mega Canvas- ja Roll-tarkistukset, rajattu lint, katalogi, tuotantokäännös ja Learnin 37 914 tarkistusta läpäisivät.

Tulostimen mittakalibrointia varten lähetettiin yksi 512 × 660 pisteen kuitti nykyisen USB-palvelun kautta. Sen X- ja Y-mittavälit ovat kumpikin 400 pistettä, ristien keskipisteestä keskipisteeseen. Käyttäjä mittasi paperilta molemmille suunnille 56,6 mm. Laskennallinen mittakaava on siten noin 7,067 pistettä/mm eli 179,5 dpi molemmilla akseleilla; 512 pisteen alue vastaa noin 72,45 mm:ä. Tulos on lähellä 180 dpi:tä ja sulkee tämän laitteen nykyisillä asetuksilla pois 203 dpi:n oletuksen. Paperin koko leveys ja tulostusalueen reuna-offset odottavat erillistä mittausta. Kuitti ei kulkenut uuden Surface Composer -käyttöliittymän tai rasteriviennin kautta. Tulos tallennettiin tulostinkohtaiseksi kalibrointiaineistoksi; yleisiä materiaalioletuksia ei muutettu.

Sivureunojen jatkokokeessa käyttäjä mittasi alkuperäisestä vedoksesta vasemmalle 4,6 mm ja oikealle 3 mm. Sen perusteella oikeaa rajaviivaa siirrettiin rasterisarakkeesta 510 sarakkeeseen 499 vasemman pysyessä sarakkeessa 1. Käyttäjä vahvisti uuden vedoksen molemmiksi sivumarginaaleiksi 4,6 mm. Tämä on nykyisen tulostuspolun fyysisesti tarkistettu symmetrinen rajaus; 4 mm:n vasenta reunaa ei ole vahvistettu. Paperin tarkka kokonaisleveys ja laitealueen alku pysyvät arvioina. Tulostimen asetuksia tai yleisiä materiaalioletuksia ei muutettu.

## Sisällön kohdistuksen toteutus

[surface-render.js](../src/surface-render.js) sijoittaa viiva- ja rasterilähteen yhteen globaaliin millimetrikoordinaatistoon. Suikaleen liike tai kierto muuttaa vain siitä poimittavaa aluetta, ei lähdekuvan sijoitusta. Lähteen kuvasuhde säilyy: `contain` näyttää koko lähteen ja `cover` peittää tavoitealueen siten, että teospinnan rajat leikkaavat ylimenevän sisällön.

| Rajapinta | Käyttö |
| --- | --- |
| `createContentPlacement`, `contentTransform` | JSON-muodossa tallennettava lähteen sijoitus, yhtenäinen mittakaava, kierto ja molempiin suuntiin toimiva muunnos. Graafin viivoille lähdeyksikkö on millimetri ja kuvalle pikseli. |
| `placePathsOnSurface` | Viivat rajataan lähteen alueeseen, muunnetaan ja rajataan teospintaan kerran. Tulos annetaan nykyiselle `clipPathsToStrip`-funktiolle kunkin suikaleen kohdalla. Kynäkerros, pisteiden syvyys ja huoltomerkinnät säilyvät. |
| `createRasterSampler` | Alkuperäisen RGBA-kuvan näytteistys globaalista sijainnista: bilineaarinen tai lähimmän pikselin interpolointi, läpinäkyvyys valkoiselle. Kuvan ja teospinnan ulkopuoli jää valkoiseksi. |
| `createStripRasterPlan` | Eksplisiittinen X/Y-pikselitiheys sekä koko paperin tai pelkän tulostusalueen rasterimitat. Pyöristetyn rasterin fyysinen ulottuvuus raportoidaan erikseen tavoitemitoista, eikä kuvan mittakaavaa muuteta pyöristyksen vuoksi. |
| `createStripRasterizer` | Yksi muuttumaton suikaleen ja sijoituksen tilannekuva. `renderBlock(rowStart, rowCount)` palauttaa RGBA-rivejä aina absoluuttisista suikalekoordinaateista, joten lohkojen välille ei tule saumaa. Paperialueen viennissä myös tulostumattomat reunat säilyvät valkoisina. |

Yhden lohkon raja on 1 048 576 pikseliä eli 4 MiB RGBA-dataa; rasterin leveysraja on 16 384 pikseliä. Nämä ovat muistirajoja, eivät tulostimen tai suikaleen fyysisiä pituusrajoja. Kutsuja aikatauluttaa lohkot ja voi keskeyttää työn niiden välissä. Alkuperäisen kuvan pikselitaulukko jaetaan vain lukuun, eikä kutsuja muuta sitä kesken rasterointityön.

[validate-surface-render.mjs](../tools/validate-surface-render.mjs) sisältää 16 läpäissyttä tarkistusta. Ne kattavat viiva- ja rasterikohdistuksen samat globaalit pisteet, analyyttiset 45/90 asteen pikselit, peittävät ja läpinäkyvät pikselit, kuvan ulkopuolen, paperireunat, päällekkäisyyden, lohkojen tavutarkan yhtäläisyyden sekä virhetilanteet. Kahden metrin suikale käyttää mitattua tiheyttä `400 / 56.6` pistettä/mm ja muodostaa 512 × 14 135 pisteen rasterin lohkoissa. Sisältölaskenta ei itsessään laajenna kuittipalvelun 4096 rivin työrajaa; version 2.179 erillinen suikalepolku kuvataan alla.

Rasterituloksista muodostettiin erillinen diagnostinen havainnekuva: sama ympyrä, ruudukko ja diagonaali lähteenä sekä koottuna 12 kiertyvästä paperisuikaleesta. Havainne on laskentatuloksen tarkistus, ei kuvakaappaus vielä toteuttamattomasta editorista. Myöhemmät vaiheet toteuttivat käyttöliittymän, alkuperäisen kuvatiedoston latauksen ja projektitallennuksen. Käyttäjän PNG-vienti toteutettiin versioon 2.180 alla kuvatulla tavalla.

## Editorin käyttö ja tallennus

Yläpalkin **Surface Composer** avaa suuren editorin. Vasemmalta valitaan nykyisen graafin viivaulostulo tai alkuperäinen PNG/JPEG/WebP-kuva, teospinnan mitat ja suikalejaon asetukset. Uusi **Generate strips** korvaa asettelun nimenomaisesti; pelkkä asetusten tai Strip Tiling / Freeform Strips -välilehden vaihtaminen ei poista käsin muokattuja suikaleita. Undo palauttaa myös korvatun asettelun.

Paperia voi vetää, oranssista kahvasta kiertää ja sinisestä kahvasta muuttaa pituutta niin, että alkupää pysyy paikallaan. Shift kohdistaa kierron 15 asteen askeliin. Oikealla ovat numeeriset sijainti-, kierto-, pituus-, paperi- ja tulostusaluemitat sekä erillinen kerros- ja tulostusjärjestys. Listasta voi valita myös piilotetun paperin. Lisäksi voi lisätä, monistaa ja poistaa suikaleita. Rulla zoomaa hiiren kohdalle, tyhjän taustan veto siirtää näkymää ja Fit all sovittaa todelliset paperiulkomitat.

[surface-session.js](../src/surface-session.js) hallitsee validoitua, versioitua `surface`-kenttää projektissa. App käyttää omaa nykyistä `evalLevel`-moottoriaan suoraan teospinnan W/H-mitoilla, myös ryhmien sidotuille sisääntuloille. Suikaleen veto käyttää paikallista tilapäistilaa ja päivittää sovelluksen vasta vedon lopussa. Sen vuoksi vetäminen ei arvioi graafia uudelleen. Esikatselun sisältö määritellään kerran ja rajataan suikaleisiin SVG-leikkausalueilla samoista geometriakulmista; erittäin tiheä viivakuva voi käyttää erikseen ilmoitettua esikatseluharvennusta.

**Save project** tallentaa saman `.muusia.json`-projektin kuin Muusian Save. Mukana ovat suikaleet, mitat, valittu lähde/ryhmäpolku ja alkuperäinen kuvatiedosto ilman pienennystä. Tuetun kuvan raja on 8 MB / 25 megapikseliä. Vanha projekti ilman `surface`-kenttää sekä Help-esimerkin lataus alustavat Surface Composerin uudelleen. Virheellinen uusi kenttä hylätään ennen graafin vaihtamista. Selaimen oletusprojekti käyttää samaa tallennusta; suuri kuva voi ylittää selaimen paikallisen tallennuskiintiön, jolloin projektitiedoston Save on käytettävissä.

Nimellinen paperileveys on editorin alussa 80 mm, tulostettava leveys 70,8 mm ja sivu-offset 4,6 mm. Leveys on käyttäjän muokattava nimellismitta; aiempi fyysinen koe vahvisti symmetrisen 4,6 mm rajauksen nykyisellä Epson-polulla, ei täsmälleen 80 mm paperileveyttä. Mega Canvas- ja Roll Mode -välilehdet käyttävät versiosta 2.181 alkaen samaa editoria ja kahvoja; erilliset aiemmat ohjaimet on korvattu yhteisen näkymän avaavalla pienellä paneelilla.

[validate-surface-session.mjs](../tools/validate-surface-session.mjs) lisää 10 testiä, myös todellisesta App-lähteestä luetun evalLevel-moottorin, Grid- ja Value-solmujen sekä sidotun ryhmän tarkistukset. Yhteensä 44 kohdennettua testiä, lint, katalogi, tuotantokäännös ja Learnin 37 914 tarkistusta läpäisivät. Selaimessa tarkistettiin graafilähde, diagonaalijako, veto ja veto zoomattuna, kahvojen kierto/pituus, numeeriset kentät, virheellisen mitan peruminen, näkyvyys, monistus/poisto, näppäimistön Undo, kuvalataus ja Roll Modeen siirtyminen. Oikea Save/Load/Save palautti 34 suikaleen sommitelman `surface`-kentän täsmälleen; alkuperäinen PNG tallentui tavu tavulta samana. Vanha Learn-projekti palautti uuden tilan oletuksiin. Selainkokeessa ei kirjautunut varoituksia tai virheitä.

## Kokonaismetrit ja tulostuksen jatkaminen (2.179)

[surface-production.js](../src/surface-production.js) laskee näkyvien suikaleiden kokonaispituuden sekä muokattavan syöttö-/leikkausvaran per suikale. **Surface & paper → Total paper** ja alareunan yhteenveto näyttävät metrit ja sen, mahtuuko teos annettuun rullaan. Oletusrulla on 80 m, varaus 1 m ja lisävara 20 mm/suikale. **Already used** annetaan käsin; se ei ole paperianturin lukema eikä päivity automaattisesti. Arvio riippuu annetuista rullan ja lisävaran arvoista. Piilotettu paperi ei kuulu budjettiin tai tulostussuunnitelmaan.

**Print / continue** valitsee yhden näkyvän suikaleen ja sen **Start at / End at** -millimetrivälin. Tyhjä loppukohta tarkoittaa suikaleen loppua. Rajaus siirtää vain poimittavaa osaa samasta globaalista kuvasta; lähdettä ei soviteta uudelleen eikä aloiteta alusta. Valmistunut osaväli siirtää jatkokohdan samassa suikaleessa eteenpäin. Valmistunut kokonainen suikale valitsee seuraavan tulostusjärjestyksessä, mutta ei lähetä sitä.

Oletus on aina **yksi suikale kerrallaan**. Käyttäjä odottaa tulostimen jäähtymistä ja käynnistää seuraavan käsin. **Print remaining consecutively** on erikseen rastitettava valinta lyhyille suikaleille: se tulostaa valitusta aloituskohdasta loppuun ja sitten jäljellä olevat näkyvät suikaleet järjestyksessä. Valintaa ei tallenneta projektiin eikä palauteta latauksessa. **Stop after current** pysäyttää jatkon seuraavien töiden välissä; käynnissä olevaa fyysistä suikaletta ei katkaista. Valmistelun voi keskeyttää ennen lähettämistä.

[surface-print.js](../src/surface-print.js) käyttää alkuperäistä kuvaa tai Appin todellista graafiarviointia, yhteistä koordinaattimuunnosta ja 256 rivin rasterilohkoja. Epson-profiili käyttää mitattua tiheyttä `400 / 56.6` pistettä/mm molemmilla akseleilla ja fyysisesti tarkistettuja turvallisia rasterisarakkeita 1…499. Pään offset 4,38775 mm on mittauksista johdettu arvio. Profiili vaatii nimellisen 80 mm paperin; paperin kokonaisleveys on edelleen tarkasti mittaamatta. Värit muunnetaan mustavalkoiseksi pistekuvaksi.

Sama paikallinen Print-palvelu hyväksyy `/api/strip-jobs`-reitillä yhden 512 × enintään 65 535 rivin suikaleen (noin 9,27 m). Tämä on nykyisen palvelupyynnön raja, ei teospinnan tai paperimallin enimmäispituus. Koko suikale on **yksi työ**: ESC/POS-lohkot eivät ole erillisiä jonotöitä, ja leikkaus tulee vain lopussa, jos se valitaan. Tavallinen `/api/jobs` säilyttää 4096 rivin rajansa. Suikaletyö edellyttää tyhjää aktiivijonoa ja pysäytettyä Clock-tilaa. Esikatselukuvien muistihistoria on rajattu 32 MiB:iin.

Lähetystä ennen tallennetaan työn tunniste. Sama tunniste ei lisää palvelimeen toista työtä. Epäselvä verkkotulos säilyttää tietueen ja estää uuden lähetyksen, kunnes **Check last job** tai käyttäjän tietoinen kuittaus ratkaisee tilanteen. Pieni keskeneräisen työn tietue palautuu myös sivun latauksen jälkeen; mitään ei lähetetä automaattisesti uudelleen. Palvelimen `done` tarkoittaa tavujen kirjoitusta, ei tietoa fyysisen paperin loppumisesta tai jäähtymisestä.

**Tarkistus:** yhteensä 51 kohdennettua JS-testiä (18 geometria, 16 sisältö/rasteri, 10 projekti, 7 tuotanto), 9 palvelintestiä, lint, katalogi, tuotantokäännös ja 37 914 Learn-tarkistusta läpäisivät. Todellinen selain lähetti kuivatestipalveluun yhden 2000 mm kuvasuikaleen (14 135 riviä), yhden 450–550 mm osavälin sekä kaksi erikseen valittua peräkkäistä 100 mm graafisuikaletta. Neljä työtä, neljä lopullista leikkausta; oletustilassa ei yhtään automaattista seuraavaa työtä. Metri-/rullavertailu ja projektin tallennus/lataus tarkistettiin. Uuden pitkän suikaleen fyysistä paperikoetta ei tehty.

Print-palvelun päivitys asennettiin Pi:lle 13.11.2026 ja USB-valmius sekä uusi kyvykkyysrajapinta tarkistettiin ilman tulostusta. Palautusvarmuuskopio: `/home/print/muusia-print/server.py.before-surface-20261113-001303`. Tulostimen asetukset, firmware ja koneen makrot säilyivät.

## PNG- ja ZIP-vienti (2.180)

Editorin vasemman laidan **Export PNG** tallentaa **Export selected PNG** -painikkeella valitun näkyvän suikaleen kokonaisena. **Export all PNGs + manifest · ZIP** vie kaikki näkyvät suikaleet tulostusjärjestyksessä ja lisää `manifest.json`-luettelon. Tulostuksen **Start at / End at** -kohdat eivät rajaa vientitiedostoja, eikä vienti muuta tulostuksen jatkokohtaa tai lähetä tulostustyötä.

Oletustarkkuus on Epsonin mitattu `400 / 56.6` pistettä/mm eli noin 179,5 dpi. Vaihtoehdot ovat 150, 300 ja 600 dpi. Koko paperin vienti säilyttää valkoiset tulostumattomat reunat; **Printable area only** alkaa tulostusalueen offsetista ja kertoo tämän myös metatiedoissa. Alkuperäisen kuvan värit ja graafin kynävärit säilyvät. Graafiviivan leveys on 0,3 mm; esikatselun näyttöpikseleihin sidottu viivavahvistus ei kuulu vientiin. Tulostettaessa valitaan **actual size / 100%** ja poistetaan sovitus sivulle.

[surface-export.js](../src/surface-export.js) käyttää yhteistä `createStripRasterPlan`-/`createStripRasterizer`-kohdistusta. [surface-source.js](../src/surface-source.js) jakaa alkuperäisen kuvan lukemisen ja todellisen graafiarvioinnin PNG- ja kuittipoluille. Kuittipolun lähteenvalmistelun toiminta säilyi samana. Värilliset viivat rajataan samoilla `clipPathsToStrip`-koordinaateilla kuin tulostuksessa.

PNG kootaan suoratoistona enintään 256 rivin ja olemassa olevan 1 048 576 pikselin lohkorajan sisällä: RGB-rivit, zlib, PNG-lohkot ja CRC. Kokonaista pitkää kuvaa ei piirretä selaincanvakseen, eikä selaincanvaksen korkeustoleranssi rajoita PNG:n pituutta. `pHYs` kertoo kokonaislukupisteinä/metri pyöristetyn tiheyden; UTF-8 `iTXt` sisältää suikaleen tarkan millimetrigeometrian ja laskennallisen tiheyden. PNG:n ja manifestin tavoitemitat sekä pikseleiksi pyöristetyt ulottuvuudet raportoidaan erikseen, eikä lähdettä skaalata pyöristettyyn leveyteen.

ZIP saa PNG-lohkot yksi suikale kerrallaan nykyisen `fflate`-kirjaston kautta. Manifestissa ovat vakaa ID, näkyvä numero, tulostusjärjestys, kerros, keskipiste, kierto, pituus, fyysinen/tulostettava leveys ja offset, kulmapisteet sekä tiedostonimi, pikselimitat ja tiheys. Tiedostonimien järjestysnumero seuraa näkyvien suikaleiden tulostusjärjestystä; tekstiosa puhdistetaan tiedostopolkua varten. Alkuperäinen ID säilyy metatiedoissa. Paperimetrit eivät tässä sisällä syöttö-/leikkausvaraa, koska PNG ei syötä paperia.

Resurssirajat: 100 miljoonaa pikseliä/suikale, 250 miljoonaa pikseliä/vienti ja 128 MiB säilytettävää tulostiedostoa, sekä rasterimoduulin 16 384 pikselin leveysraja. Nämä ovat selainresurssien rajoja; mittoja ei pienennetä automaattisesti. Rajan ylittyessä valitaan pienempi tarkkuus tai viedään suikaleet erikseen. **Cancel export** peruu työn lohkojen välissä; osittaista PNG:tä tai ZIP:iä ei ladata. Sommittelun ja tulostuksen ohjaimet odottavat viennin valmistumista.

**Tarkistus:** [validate-surface-export.mjs](../tools/validate-surface-export.mjs) lisää 7 testiä: itsenäinen PNG-lukija tarkistaa jokaisen CRC:n ja koko IDAT-virran, värit ja läpinäkyvyyden, valkoiset reunat, `pHYs`/UTF-8-metatiedot, ZIP:n järjestyksen ja ID:t, 0/45/90/137 asteen näytteet sekä 100 000 rivin suoratoiston, keskeytyksen ja kokorajojen hylkäyksen. Yhteensä 58 kohdennettua JS-testiä, lint, katalogi, tuotantokäännös ja Learnin 37 914 tarkistusta läpäisivät.

Todellisesta selaimesta ladattiin alkuperäiskuvan 1 m PNG (566 × 7068), vastaava kolmen suikaleen ZIP, pelkkä tulostusalue (501 × 7068), 10 m PNG (566 × 70 672) sekä punaisen Grid-graafin 0/45/137 asteen kolme suikaletta (566 × 1838). Piilotettu neljäs suikale ei kuulu ZIP:iin. Ladatut tiedostot purettiin ja tarkistettiin erillisellä PNG/ZIP-lukijalla; myös reunat ja punaiset pikselit tarkistettiin. Yksittäinen kolmas PNG vastasi ZIP:n kolmatta PNG:tä tavulleen. Keskeytys ja 600 dpi:n liian suuren työn hylkäys tarkistettiin selaimessa. Viennin jälkeinen todellinen projektitallennus säilytti `surface`-kentän täsmälleen, myös alkuperäiskuvan, piilotetun paperin ja tulostuksen jatkokohdan. Selaimessa ei kirjautunut varoituksia tai virheitä. Tässä vientivaiheessa ei tulostettu paperille.

## Mega Canvas ja Roll samassa editorissa, myös freeform (2.181)

Kaikki neljä välilehteä pysyvät Surface Composerissa. Mega Canvasin arkit ja Rollin kokonaiset suikaleet käyttävät samaa millimetripohjaista paperiobjektia, lähdekuvan/graafin kohdistusta, suurta esikatselua, valintaa, vetoa, kierto- ja pituuskahvaa, numeerisia kenttiä, järjestyksiä sekä Undo/Redoa. **Freeform layout** ottaa vapaan muokkauksen käyttöön; paperin siirtäminen tai koon muuttaminen tekee sen myös automaattisesti. Koko paperin kuva-alueen leveys seuraa paperileveyttä, jos tulostusalue oli koko paperi. Erillinen kapeampi kuva-alue säilyy omana mittanaan.

**Sheet layout** sisältää arkkileveyden/-korkeuden, sarakkeet, rivit sekä Overlap/Gap-sauman. **Roll layout** sisältää rullaleveyden, kokonaissuikaleen pituuden ja määrän sekä piirturin työosan pituuden. Paperimitat, määrä ja sauma ovat generaattorin asetuksia: ne eivät muuta käsin tehtyä sommitelmaa ennen **Generate sheets / Generate roll strips** -painiketta. Generointi on Undo-askel. Freeformin poistaminen generoi säännöllisen jaon; Undo palauttaa vapaat paperit. Työosan pituus puolestaan vaikuttaa vientiin heti, eikä pilko fyysistä suikaletta editorin erillisiksi papereiksi. Siniset katkoviivat näyttävät työosien rajat myös kierretyssä suikaleessa.

Arkkipaneeli näyttää näkyvien arkkien määrän, pinta-alan ja yhteispituuden. Roll ja Strip Tiling näyttävät kokonaismetrit syöttö-/leikkausarvioineen ja rullavertailun. Arkit käyttävät aluksi koko paperia tulostusalueena; lämpöpaperin mitattu 4,6 mm oletus kuuluu edelleen alkuperäiseen Strips-tilaan. Valitun paperin mittoja voi muokata erikseen kaikissa freeform-sommitelmissa.

[surface-layouts.js](../src/surface-layouts.js) validoi asetukset ja kuvaa saman arkkijaon/rullajaon paikat kuin nykyinen `sliceMega`/`sliceRoll`. Se ei korvaa vanhoja viejiä. Tallennettavan istunnon `composition` sisältää perheen (`Sheets`/`Roll`), generaattorin nykyiset asetukset ja erikseen viimeksi generoidut asetukset. Säännölliseksi merkitty mutta poikkeavan geometrian sisältävä tuonti tulkitaan freeformiksi. Virheellinen viimeksi generoitu asettelu hylätään.

Projektin uusi `surfaceLayouts`-kenttä, versio 1, sisältää omat täydet istunnot `Sheets`- ja `Roll`-paikoissa. Alkuperäinen `surface` säilyttää Strip Tiling / Freeform Strips -sommitelman. Välilehden vaihto säilyttää kaikkien kolmen paperit, lähteet, mitat ja tuotantotiedot. Vanha projekti ilman uutta kenttää saa tyhjät lisäpaikat, jotka alustetaan vanhoista `canvas`-/`mega`-asetuksista ensimmäisellä avauksella. Vanhat `mega`-kentät säilytetään säännöllisen jaon yhteensopivuutta varten. Uusi kenttä validoidaan ennen graafin vaihtamista. Myös projektin oletustallennus käyttää tätä samaa sisältöä.

[surface-vector-export.js](../src/surface-vector-export.js) käyttää säännölliseen jakoon suoraan Appin nykyisiä leikkureita. Freeformissa graafin viivat muunnetaan ja rajataan `clipPathsToStrip`-funktiolla paperin omiin koordinaatteihin, jolloin kynäkerros, syvyys ja huoltomerkinnät säilyvät. Rollin paikalliset työosat rajataan olemassa olevalla `cropTestPiece`-funktiolla. Nykyisiltä leikkureilta käytetään rajaus-/kohdistusmerkit ja olemassa olevalta `fontStrokes`-funktiolta tunnisteet. Jokainen osa annetaan samoille SVG-, DXF- tai G-code-viejille oikeilla W/H-mitoillaan. Vienti ei sovita sisältöä uudelleen. Enimmäismäärä on 8192 työosaa ja tekstiaineiston raja 128 MiB. Useampi tiedosto pakataan nykyisellä ZIP-rakentajalla.

**Plotter / vector files** vie kaikki näkyvät paperit tai vain valitun paperin osineen. **Source SVG · full artwork** on alkuperäisen koko teoksen vektoriviite, ei vapaiden paperien asennuskartta. Kuvalähteelle käytetään PNG:tä; graafiviivat tukevat myös SVG/DXF/G-codea. PNG-manifestin `layoutFamily` ja paperikulmat kuvaavat myös arkkien ja Rollin vapaan sommitelman. Fyysinen piirturin työalue näytetään ja ylittävästä paperista/työosasta ilmoitetaan. Paperia tai piirturia ei käynnistetä tiedostoviennistä.

Graafin nykyiset animaatiopakettiviennit säilyvät säännöllisille asetteluille, joissa lähde on sama valittu graafi. Vapaiden sommitelmien animaatiopaketti ja magneettijigin vienti ovat vielä jatkotyötä; niiden vienti tapahtuu omasta paneelista. Myös erikseen valitun lähteen tai rasterilähteen kohdalla vanha säännöllinen graafivienti ohjataan yhteiseen editoriin ja säännöllisen magneettijigin ohjaimet piilotetaan, jotta käyttäjä ei saa väärän asettelun tiedostoja. Epsonin suora tulostuspaneeli näkyy Strips-tilassa sekä nimellisellä 80 mm Roll-paperilla. Yksi suikale kerrallaan ja erikseen rastitettava jatkotulostus säilyvät.

**Tarkistus:** [validate-surface-layouts.mjs](../tools/validate-surface-layouts.mjs) lisää 8 testiä: todellisten App-leikkureiden säännöllinen geometria, generaattoriasetusten erillisyys, riippumattomat projektipaikat, stale grid -tilan tunnistus ja virheelliset projektit, kierretyn arkin syvyys/kerros/huoltotiedot, paikallisen Rollin jatkuvuus ja lyhyt loppu, näkyvyys/järjestys/tunnisteet sekä todelliset osamitat. Yhteensä 66 kohdennettua JS-testiä sekä nykyiset Mega/Roll/Preview Crop -tarkistukset läpäisivät. Katalogi, tuotantokäännös ja Learnin 37 914 tarkistusta läpäisivät. Nykyisen graafi-/vientiputken seuratuille lähdealueille ei tullut muutosta; vientitodisteita tai tarkistuksia ei ohitettu.

Todellinen selain latasi vanhan Mega-projektin. Säännöllisen jaon neljä SVG:tä vastasivat vanhan käyttöliittymän vientiä tavulleen. Arkkia vedettiin ja kierrettiin 24°; Undo/Redo ja säännöllisen jaon palautus/Undo tarkistettiin. Rollin suikale kierrettiin 14°, siirrettiin ja pidennettiin 1050 mm:iin. 400 mm työosilla syntyi kuusi SVG:tä (viimeiset 250/150 mm); 200 mm työosilla syntyi yksitoista G-codea (viimeiset 50/150 mm). Valitun suikaleen DXF-vienti sisälsi kuusi osaa. Neljä arkkien DXF/G-codea, molempien tilojen PNG-paketit sekä alkuperäiskuvan arkkivienti tarkistettiin. 5757 varsinaista SVG-pistettä muunnettiin erillisessä tarkistuksessa takaisin teospinnalle: ne osuivat alkuperäiseen ruudukkoon SVG:n 0,01 mm pyöristyksen tarkkuudella, ja Rollin osarajojen jatkuvuus täsmäsi. G-code-koordinaatit ja DXF:n fyysiset rajat tarkistettiin. Save/Load/Save säilytti kaikki kolme istuntoa, alkuperäiskuvan ja graafin täsmälleen. Selaimen varoitus-/virheloki oli tyhjä. Tässä vaiheessa ei tulostettu tai piirretty fyysisesti.

## Sommittelupohjat kaikille paperiperheille (2.182)

**Arrange papers** toimii Mega Canvasissa, Rollissa ja Strip Tiling / Freeform Strips -sommitelmassa. Se käyttää näkyviä nykyisiä papereita tulostusjärjestyksessä. Paperimäärä ja perusmitat luodaan ensin entisillä Generate-ohjaimilla. Pelkkä pohjan valinta tai parametrin muutos ei siirrä paperia; **Arrange N visible papers** tekee asettelun yhtenä Undo-askeleena ja siirtyy freeformiin. Fit all sovittaa vain kameran. Paperien mittoja tai koko teoksen lähdettä ei soviteta uudelleen. Piilotetut paperit pysyvät paikoillaan.

[surface-arrangements.js](../src/surface-arrangements.js) toteuttaa neljä puhdasta, validoitua asettelua yhteisille paperiobjekteille:

- **Fan**: sama pivot ja säädettävä keskikulma sekä kulmaleveys. Etäisyys pivotista tarkoittaa paperin yläkeskikohdan etäisyyttä; nolla antaa yhteisen lähtöpisteen. Oletuspivot on teospinnan alareunassa ja keskikulma 180° (ylöspäin). Eri pituiset paperit säilyvät omissa mitoissaan.
- **Radial**: pivot, aloituskulma, 0–360° kaari ja etäisyys paperin alkuun. Täysi kierros käyttää N eri kulmaa, joten ensimmäistä paperia ei kahdenneta 360° kohdalla. Osakaari sisältää molemmat päät, ja yhdellä paperilla käytetään annettua aloituskulmaa.
- **Progressive Rotation**: vaakarivissä symmetrisesti asetetut keskipisteet, niiden väli, ensimmäisen paperin kulma ja kulma-askel. Keskipisteväli on eri asia kuin fyysinen paperirako; kiertyvät paperit saavat mennä päällekkäin.
- **Random**: keskipistealueen leveys/korkeus, keskikulma, kulmavaihtelu ja 32-bittinen siemen. Aluerajat koskevat paperien keskipisteitä, eivät koko paperin kulmia. Valinnainen **Vary paper length** käyttää absoluuttista minimi-/maksimipituutta; ilman valintaa jokainen nykyinen pituus säilyy. Samalla siemenellä tehty uudelleenajo ei kerrytä pituusmuutoksia.

Random käyttää nykyistä `mulberry32`-generaattoria ja vakaasta paperitunnisteesta johdettua siementä. Siksi muun paperin piilottaminen ei arvo näkyviä uudelleen. Myös sijainti-/kulmanäytteet pysyvät samoina, kun vain pituusvaihtelun kytkee päälle. **New variation · seed +1** vaihtaa siemenen ja asettelee yhdellä Undo-askeleella; 4294967295:n jälkeen siemen on 0.

Asettelu säilyttää paperien ID:t, listajärjestyksen, print/Z-järjestykset, fyysisen leveyden, tulostusalueen ja lähteen. Vain Randomin nimenomaisesti valittu pituusvaihtelu muuttaa pituuksia. Tulostuksen alku-/loppukohta nollataan uudelle sommitelmalle, mutta työn tietue ja manuaalinen jatkokäytäntö säilyvät. Mitään ei tulosteta tai lähetetä automaattisesti.

Istunnon valinnainen `arrangement` tallentaa pohjan nykyiset asetukset. Se säilyy sekä alkuperäisessä `surface`-kentässä että kummassakin `surfaceLayouts`-paikassa. Tallennetut paperipositiot ovat aina varsinaisen sommitelman totuus: käyttäjä voi muokata niitä pohjan jälkeen tai tallentaa vielä soveltamattomat asetukset. Vanha projekti ilman kenttää säilyy ennallaan ja saa ohjaimiin lasketut oletukset. Virheelliset uudet asetukset hylätään ennen graafin vaihtamista.

**Tarkistus:** [validate-surface-arrangements.mjs](../tools/validate-surface-arrangements.mjs) lisää 8 testiä pivotin analyyttiselle sijainnille, täyden kierroksen yksikäsitteisyydelle, osakaarille, kulma-askeleille, per-ID-satunnaisuudelle ja rajoille, pituusvaihtelun toistettavuudelle, piilotetuille papereille, materiaali-/tuotantotiedoille, kolmen perheen projektitallennukselle, kiinteän globaalin viivan kohdistukselle ja 4096 paperin rajatapaukselle. Yhteensä 74 kohdennettua JS-testiä, lint, katalogi, tuotantokäännös ja Learnin 37 914 tarkistusta läpäisivät. Vanhoja vientitodisteita tai koneprofiileja ei muutettu.

Todellinen selain tarkisti kaikki neljä pohjaa, Fanin Undo/Redon (24° → 135° → Undo 24° → Redo 135°), Randomin samansiemenisen uudelleenajon, uuden siemenen ja Undon sekä piilotetun paperin vaikutuksen. Kolmen perheen Save/Load/Save säilytti istunnot ja graafin täsmälleen. Fanin neljä, Randomin neljä sekä Progressiven Rollin yksitoista varsinaista SVG-tiedostoa tarkistettiin erikseen: 6916 SVG-pistettä palautui alkuperäiselle ruudukolle SVG:n 0,01 mm koordinaattipyöristyksen tarkkuudella. Radial Stripsin kolme PNG:tä ja Random-arkkien neljä PNG:tä vastasivat tallennettua geometriaa ja manifestia. Selaimen varoitus-/virheloki oli tyhjä. Paperille tai piirturille ei ajettu mitään tässä vaiheessa.

## Nykyiset osat ja niiden käyttö

| Osa | Toteutus | Surface Composerin ratkaisu |
| --- | --- | --- |
| Teoksen mitat | [App.jsx](../src/App.jsx): `megaW`, `megaH` ja yhteinen `ctx.W/H` | Käytä samaa graafin arviointia. Suikaleiden liikuttaminen ei muuta teoksen mittoja eikä generoi koko kuvaa uudelleen. |
| Arkkijako | App.jsx: `sliceMega` | Säilytä nykyinen arkkipolku. Leikkaus käyttää akselien suuntaisia suorakulmioita ja palauttaa arkkikohtaiset paikalliskoordinaatit. |
| Rullajako | App.jsx: `sliceRoll`, `megaTiles`, `tileTag` | Säilytä nykyinen rullapolku ja hyödynnä sen osakohtaisia W/H-mittoja, numerointia ja vientijärjestelyä. Rulla koostuu fyysisestä suikaleesta ja piirturin työalueelle sopivista osista; nämä ovat eri käsitteitä. |
| Viivojen rajaus | [preview-crop.js](../src/preview-crop.js): `cropTestPiece` | Käytä suikaleen paikalliseen koordinaatistoon muunnettujen viivojen leikkaukseen. Funktio hyväksyy vapaat suorakulmion mitat, säilyttää polun lisäkentät ja pisteiden syvyyden sekä käsittelee katkenneen suljetun polun. |
| Esikatselu | App.jsx: `PathsSVG`, `ZoomBox`, suuri esikatselu | Hyödynnä nykyisiä kynävärejä ja esikatselun kuvapiirtoa. Lisää suikaleiden paperi- ja tulostusalueet sekä valinta omana kerroksenaan. Nykyinen zoomauksen raahaus on sovitettava yhteen suikaleiden raahauksen kanssa. |
| Vektorivienti | App.jsx: `toSVG`, `toDXF`, `toGcodeGated` | Anna olemassa oleville viejille suikaleen paikalliset viivat ja oikeat fyysiset W/H-mitat. Säilytä koneprofiilien vientirajat. Rasterikuva ei muutu automaattisesti piirrettäviksi viivoiksi. |
| Pakkaus | App.jsx: `buildZip`; projektin `fflate`-riippuvuus | Nykyinen ZIP-rakentaja koodaa vain `file.text`-sisällön UTF-8:ksi. PNG-paketti tehdään jo mukana olevalla `fflate`-kirjastolla, jotta binääridata säilyy. Nykyistä ZIP-polkua ei tarvitse muuttaa prototyyppiä varten. |
| Kuvan lataus | [analyze.js](../src/analyze.js): `intakeImage`; App.jsx:n kuvalataus | Käytä olemassa olevaa kuvan lukemista soveltuvin osin. Alkuperäinen lähdekuva säilytetään rasterivientiä varten; analyysiin pienennetty kuva ei yksin riitä suuren teoksen lähteeksi. |
| Projektit | App.jsx: `buildPatchJSON`, `loadPatch`, autosave | Lisää versioitu `surface`-kenttä. Säilytä vanha `mega`-kenttä ja vanhojen projektien tulkinta. |
| Kuittitulostus | [thermal-print.js](../src/thermal-print.js), [server.py](../print-server/server.py) | Nykyinen kuittivienti säilyy. Uusi [surface-print.js](../src/surface-print.js) lähettää pitkän suikaleen yhtenä työnä saman palvelimen erilliselle suikalereitille. |

`sliceMega`, `sliceRoll`, `buildZip`, `toSVG`, `toDXF` ja `ZoomBox` ovat katselmuksessa paikallisesti samat kuin haetussa origin/main-versiossa. `PathsSVG` ja kuittitulostuksen ympäristö ovat muuttuneet, joten niiden toteutuksessa käytetään uusinta lähdettä.

Mega Canvasin ja Roll Moden leikkausfunktioissa on keskenään toistuvaa suorakulmioleikkausta. Niitä ei ensimmäisessä prototyypissä tarvitse purkaa tai korvata: uudelle suikaleelle riittää koordinaattimuunnos ja olemassa oleva `cropTestPiece`. Yhteinen leikkausydin voidaan myöhemmin irrottaa erillisessä muutoksessa, jos sille syntyy todellinen tarve. Vanhojen leikkainten nykyinen polkumetadatan käsittely ei myöskään ole uuden toiminnon malliksi yhtä kattava kuin `cropTestPiece`.

## Katselmuksen tulostusmitat ja alkuperäisen kuittipolun rajat

Seuraava osuus dokumentoi alkuperäisen katselmuksen; mitattu profiili ja nykyinen suikalepolku kuvataan yllä. Paperin fyysinen leveys, tulostusalue ja paperien välinen rako tallennetaan erikseen. Prototyypin sommitteluoletukset ovat 80 mm paperi, alustava 72 mm tulostusalue ja 8 mm fyysinen rako. Tulostusalueella on erillinen vasemman reunan offset; sitä ei oleteta kaikissa laitteissa keskelle.

Ohjeen tulostinarvot eivät sellaisinaan muodosta yhtenäistä mittakaavaa:

- 512 pistettä 203 dpi:n tarkkuudella vastaa noin 64,06 mm:ä.
- 512 pistettä 72 mm:n alueella vastaa noin 180,62 dpi:tä.
- Siksi 512 pistettä, 72 mm ja 203 dpi eivät voi kaikki ohjata samaa akselia samanaikaisesti.

Nämä ovat annettujen lukujen välisiä laskelmia. Laitteen todellinen pistejako, tulostusleveys ja reuna-offset varmistetaan asetuksista ja fyysisestä kalibrointitulosteesta ennen mittatarkkaa ESC/POS-tuotantoa. Sommittelun 72 mm pysyy muokattavana alustavana arvona. Rasterivienti käyttää omaa ilmoitettua pikselitiheyttään, eikä sitä esitetä valmiiksi kalibroituna Epson-profiilina.

Nykyinen `renderReceipt` sovittaa koko teoksen kiinteään 512 pisteen leveyteen ja laskee korkeuden kuvasuhteesta. Se sallii enintään 4096 riviä ja piirtää viivat mustina. Tulostuspalvelin hyväksyy saman 512 × 4096 rajan. Uusin palvelin jo pilkkoo rasterin 256 rivin ESC/POS-lohkoihin, mutta tämä ei poista koko työn 4096 rivin rajaa.

Kahden metrin suikale ei mahdu tähän sopimukseen. Pituutta ei ratkaista rajaamalla suikale A4/A3-kokoon tai skaalaamalla sen sisältöä pienemmäksi. Fyysinen suikale, rasteroinnin muistilohko, ESC/POS-komentolohko ja piirturin työstöosa pidetään eri asioina. Paperin syöttö, leikkaus ja tunnistealueet kuuluvat tuotantovaiheeseen.

## Yhteinen tietomalli

Surface Composer on sovelluksen tuotantonäkymä, kuten nykyinen Mega Canvas, eikä uusi graafin pin-tyyppi. Käyttöliittymän kokonaisuus on **Surface Composer → Mega Canvas / Roll Mode / Strip Tiling / Freeform Strips**. Nykyiset kaksi tilaa voivat aluksi säilyttää nykyiset ohjaimensa uuden otsikon alla.

Uuden `surface`-tilan pääosat ovat:

- `version` ja `mode` sekä teospinnan `widthMm` ja `heightMm`.
- Sisältölähde: valitun graafisolmun arvioitu viivageometria tai erikseen valittu rasterikuva. Rasterille tallennetaan yksi sijoitus teospinnalle, kuvasuhde säilyttäen.
- Materiaalin ja laitteen mitat: `physicalWidthMm`, `printableWidthMm`, `printableOffsetMm`, `dotsPerMmX`, `dotsPerMmY` ja tuotannon pituusraja. Laitetietojen kalibrointitila näkyy käyttäjälle.
- Suikaleet: pysyvä `id`, `centerXmm`, `centerYmm`, `rotationDeg`, fyysinen leveys, tulostusalueen leveys ja offset, `lengthMm`, `zIndex`, `visible`, `printOrder` ja `contentMode`.
- Generoinnin lähtöasetukset: suunta, väli, määrä, pituus ja myöhemmin presetin siemen. Luodut suikaleobjektit ovat muokkauksen lähde; asetusten muuttuminen ei huomaamatta korvaa käsin tehtyjä muutoksia.

Suikaleen tunniste, näkyvä numero, päällekkäisyysjärjestys, tulostusjärjestys ja viivojen kynäkerros ovat erillisiä asioita. `visible: false` sulkee suikaleen myös oletusvientilistasta ja paperilaskennasta. Mahdollinen kaikkien suikaleiden materiaalimäärä näytetään erikseen. Uudelleenluonti on oma nimetty toiminto, ja siirtyminen Manual Freeformiin säilyttää objektien mitat ja sijainnit.

Projektin lataus ilman `surface`-kenttää palauttaa uuden tilan oletuksiin ja pois päältä. Näin uuden projektin suikaleet eivät jää vahingossa näkyviin vanhan projektin päälle. Uuden projektin save/load sekä autosave säilyttävät myös lähdekuvan, manuaaliset muutokset ja järjestykset.

## Suikaleiden geometria ja Image Mapping

Teospinnan origo on vasemmassa yläkulmassa, X oikealle ja Y alas. Suikaleen paikallinen `(u, v)` alkaa koko paperin vasemmasta yläkulmasta; leveys on X-akselilla ja pituus Y-akselilla. Suikaleen tallennettu sijainti tarkoittaa paperin keskipistettä. Nollakulma on pystysuikale ja positiivinen kulma kiertyy näytöllä myötäpäivään.

Olkoon paperin leveys `w`, pituus `l`, keskipiste `c` ja rotaatiomatriisi `R`. Paikallisen pisteen sijainti teospinnalla on `global = c + R × (local − [w/2, l/2])`. Käänteinen muunnos on `local = R⁻¹ × (global − c) + [w/2, l/2]`. Muunnokseen ei kuulu skaalausta.

Viivasisältö muunnetaan suikaleen paikalliskoordinaateiksi ja rajataan nykyisellä `cropTestPiece`-funktiolla tulostusalueeseen: suorakulmio `(printableOffsetMm, 0, printableWidthMm, lengthMm)`, marginaali 0. Rajatun funktion tuloksesta palautetaan tulostusalueen offset paperin koordinaatteihin vektorivientiä varten. Pisteiden mahdollinen Z ja polkujen lisäkentät säilyvät.

Rasterikuvan jokainen tulostuspikseli kulkee saman local → global -muunnoksen ja kuvan yhteisen global → image -muunnoksen läpi. Esikatselussa käytetään samaa lähdekuvan sijoitusta ja suikalekohtaista leikkausta. Kuvaa ei soviteta jokaiseen suikaleeseen uudelleen. Teospinnan ja lähdekuvan ulkopuoli jää valkoiseksi. Päällekkäisten suikaleiden viennissä kumpikin saa oman vastaavan kuva-alueensa; alemman suikaleen kuvaa ei poisteta ylemmän alta.

Suoran kuvan lähde valitaan nimenomaisesti. Nykyinen Image Underlay on esikatselun referenssi, eikä sen näkyminen muuta sitä automaattisesti tulostettavaksi sisällöksi. Myöskään generatiivisen Image-solmun viivoittama kuva ja alkuperäisen rasterin suora tulostus eivät ole sama sisältövalinta.

Strip Tiling tuottaa samoja itsenäisiä objekteja kuin Freeform Strips. Yhdensuuntaisten suikaleiden keskilinjojen väli on `physicalWidthMm + gapMm`. Pysty-, vaaka- ja diagonaalijako ovat saman generaattorin eri kulmia. Diagonaalijakoa varten teospinnan kulmat projisoidaan suikaleen akseleille; tästä saadaan tarvittava määrä ja pituus. Teoksen ulkopuolelle ulottuva paperi esitetään ja lasketaan mukaan materiaalimäärään.

Esimerkiksi 23 kappaletta 80 mm paperia ja niiden 22 kappaletta 8 mm rakoja vievät poikittaissuunnassa 2016 mm. Käyttöliittymän on erotettava kiinteä 2000 mm teospinta ja tämän asettelun todellinen paperin ulkomitta. Tulostumattomat reunat kasvattavat näkyvää kuvatonta aluetta paperien välissä, mutta eivät fyysistä `gapMm`-arvoa.

## Ensimmäisen prototyypin toteutusjärjestys

| Askel | Tulos | Suunniteltu tiedostoraja |
| --- | --- | --- |
| 1. Geometria | Validoidut suikaleobjektit, local/global-muunnokset, paperin ja tulostusalueen kulmat, todelliset ulkomitat sekä pysty-, vaaka- ja diagonaaligeneraattori. | Uusi `src/surface-composer.js` ja `tools/validate-surface-composer.mjs`; nykyinen `preview-crop.js` käytössä sellaisenaan. |
| 2. Sisällön rajaus | Nykyinen arvioitu viivageometria ja suora rasterikuva kohdistuvat teospinnalle ja samoihin suikaleisiin. | Uusi `src/surface-render.js`; olemassa olevat kuvan lukemisen osat ja viejät soveltuvin osin. |
| 3. Visuaalinen editori | Suuri esikatselu, Physical Width / Printable Width / Gap erikseen, valinta, siirto, kierto sekä numeeriset sijainti- ja pituuskentät. | Uusi `src/surface-composer.jsx` ja rajattu kytkentä uusimpaan `src/App.jsx`:ään. |
| 4. Tallennus ja rasterivienti | Suikaleet säilyvät projektissa. Yksittäinen PNG ja kaikki PNG:t ZIP-pakettina sekä mitat ja järjestyksen sisältävä manifesti. | Uusi `src/surface-export.js`, `fflate` ja rajatut projektin save/load-muutokset. |

Askeleet 1–4 ovat valmiit paikallisessa versiossa 2.180. Myös kokonaismetrit, valitun suikaleen/jatkoviipaleen tulostus ja pitkän ESC/POS-työn palvelinpolku ovat käytössä. Kolmen erillisen metrin paperikoe ajettiin käsin käynnistetyin osin ja käyttäjän kuittaamin jäähtymistauoin; tarkat fyysiset mittaustulokset ovat vielä vahvistamatta. Fan-, Radial-, Progressive Rotation- ja seeded Random -pohjat lisättiin versioon 2.182 samaan paperimalliin. Seuraavana on Independent Content.

Rasterivienti tehdään yksi suikale kerrallaan ja tarvittaessa riveittäin lohkoissa. Koko kahden metrin teosta ei rasteroida ensin täydellä tulostustarkkuudella yhdeksi valtavaksi kuvaksi. Esikatselun tarkkuus on erillinen viennin tarkkuudesta. PNG:n pikselitiheys ja fyysiset mitat kirjataan manifestiin; PNG:n tulostajan on käytettävä näitä mittoja, jotta oletusarvoinen sovitus sivulle ei muuta kokoa. Suuren työn vienti voidaan perua, ja resurssirajan ylittyminen ilmoitetaan muuttamatta fyysisiä mittoja.

## Hyväksymiskriteerit

1. 2000 × 2000 mm teospinta, 80 mm paperi, muokattava 72 mm tulostusalue ja 8 mm paperiväli toimivat yli A3-pituuksilla. Arvoja ei yhdistetä yhdeksi leveydeksi.
2. Pysty-, vaaka- ja diagonaalijaot tuottavat samoilla asetuksilla samat sijainnit. Kulmat 0, 45, 90, 137 ja 360 astetta sekä local/global-edestakainen muunnos säilyttävät mitat numeerisella toleranssilla.
3. Koordinaatistoruudukko, diagonaali ja ympyrä näkyvät samoissa globaaleissa kohdissa sekä esikatselussa että takaisin sommitelluissa suikalevienneissä. Sisältö ei veny eikä keskity suikalekohtaisesti uudelleen.
4. Rako, epäkeskinen tulostusalue, peitetty suikale, päällekkäisyys ja teoksen ulkopuolelle ulottuva paperi toimivat. Suljetut polut, kynäkerrokset ja pisteiden syvyys säilyvät rajauksessa.
5. Generoidun asettelun manuaalinen siirto, kierto ja pituusmuutos säilyvät myös projektin tallennuksen ja uudelleenlatauksen jälkeen. Vanha Mega Canvas- tai Roll-projekti avautuu aiemmalla tavalla.
6. PNG-paketin tiedostot avautuvat, vastaavat näkyviä suikaleita ja sisältävät ilmoitetun pikselimäärän. Vakaa tunniste, tulostusjärjestys ja tiedostonimi täsmäävät manifestiin. Paperimetrit perustuvat fyysisiin pituuksiin.
7. Sovelluskytkennän jälkeen testataan oikeassa selaimessa valinta, raahaus zoomattuna, kierto, numeeriset kentät, save/load ja oikeat viennit. Pelkkä geometriatesti ei korvaa näitä tarkistuksia.

## Seuraavat vaiheet

Fan, Radial, Progressive Rotation ja seeded Random ovat käytössä samojen muokattavien paperiobjektien asettelutoimintoina. Independent Content arvioi sisältöä paikallisissa mitoissa suikaleen sijainnin, kulman ja tunnisteen perusteella; Image Mapping pysyy koko teoksen yhteisenä sisältönä.

Tuotannon jatkovaiheeseen kuuluu asennuskartta. Käyttäjän säädettävä tulostusjärjestys ja pitkien ESC/POS-töiden laajennus nykyiseen palvelimeen ovat jo käytössä. Nykyiset 256 rivin komentolohkot kulkevat yhtenä suikaletyönä. Leikkaus tehdään vasta fyysisen suikaleen lopussa, ei jokaisen rasterilohkon välissä. Asennuskartta käyttää täsmälleen samoja paperikulmia ja z-järjestystä kuin editori.

Materiaalimäärä on valittujen suikaleiden fyysisten pituuksien summa. Tuotannon tunniste-, syöttö- ja leikkuuvarat lisätään erikseen. Tulostusaika näytetään vasta, kun laiteprofiilissa on perusteltu nopeusarvio; grafiikka ja lämpö vaikuttavat siihen. G-code sallitaan vain viivasisällölle sopivalla koneprofiililla ja työalueella; pitkä lämpöpaperisuikale ei yksin tarkoita, että piirturi voi ajaa sen yhdessä osassa.

## Tehdyt tarkistukset ja jatkaminen

Nykyiset `validate-mega-roll.mjs`, `validate-slicemega.mjs` ja `validate-preview-crop.mjs` ajettiin sekä paikalliselle koodille että haetun origin/mainin lähteistä eristetylle tilapäiskopiolle. Kaikki läpäisivät. Roll-tarkistus kattoi 14 tapausta, mukaan lukien 2000 mm jatkuvuuden, lyhyen viimeisen osan, Gap/Overlap-erot ja suljettujen polkujen leikkauksen. Nämä osoittavat nykyisen perustan; uusia suikaleominaisuuksia ne eivät vielä testaa.

Alkuperäisessä arkkitehtuurikatselmuksessa ei muutettu sovelluskoodia. Geometria- ja kohdistusvaiheet lisäsivät erilliset moduulit; editorivaihe kytki ne Appiin uudella käyttöliittymällä ja projektitallennuksella. Nykyiset arviointi- ja vientifunktiot säilyivät. Dokumentaatiolle tarkistetaan linkit, työtilatietojen JSON ja diffi. Sovellustoteutuksen integraatiossa ajetaan rajattujen tarkistusten jälkeen [MUUSIA-AGENTS.md](MUUSIA-AGENTS.md):n yhteinen portti. `sliceMega`, `sliceRoll`, viennit ja useat tilamuuttujat kuuluvat [Learn-vientitodennuksen](../learn/lib/export-provenance.mjs) seuraamiin lähdealueisiin: niiden muutos edellyttää aitoja uusia selainvientejä ja tarvittaessa lähdevalitsinten päivitystä samassa integraatiossa. Editorin kytkentä ei muuttanut näitä seurattuja lähdealueita, ja portti läpäisi ilman vanhojen vientitodisteiden muuttamista.

## Independent Content ja kokoamisohje (2.183)

Paper content -valinta toimii Mega Canvasissa, Rollissa ja Stripsissä, myös sekoitettuna saman asettelun sisällä. Image Mapping käyttää aiempaa yhteistä teospintaa. Independent Content arvioi saman solmukaavion jokaisen alkuperäisen paperin leveydellä ja pituudella. Kuvanlähde sovitetaan kuvasuhde säilyttäen erikseen kullekin paperille. Surface Context antaa paperin pysyvän numeron, näkyvän tulostusjärjestyksen, määrän, sijainnin, kulman, mitat, etäisyyden teospinnan keskipisteestä sekä tunnisteeseen ja Content seediin sidotun uint32-siemenen. Konteksti kulkee nykyisen moottorin ja ryhmäkytkentöjen kautta; uutta arviointimoottoria ei ole. Keskeltä jatkettu tuloste rajaa alkuperäistä sisältöä ja kontekstia.

Assembly & end labels -osiosta saa kokoamis-PDF:n: skaalattu yleiskuva oikealla viiva- tai kuvasisällöllä ja kerrosjärjestyksellä; paperien sijaintitaulukko; paperikohtaiset A/B/C/D-kulmat, mitat ja kulmat; kaikkien näkyvien paperiparien dX/dY, keskipisteiden etäisyys, lähin reunaväli tai päällekkäisyys, suuntakulma ja suhteellinen kierto. Rollissa on lisäksi jokaisen koneen työpalan numero, alku/loppu ja aloituskulmien koordinaatit. Konepalat ovat jatkuvan paperin työalueita. Yleiskuvan numerot ja kohdistukset sekä mitta-, paritaulukko- ja taidekerros ovat erikseen valittavissa. PDF rajoittuu 128 näkyvään paperiin, miljoonaan taidepisteeseen ja 128 MiB:n tiedostoon.

End label: Off (oletus), Attached panel tai Tear-off. Numero, kohdistus ja sijaintiteksti ovat erikseen pois kytkettävissä. Lappu lisätään alkuperäisen kuvan perään; kuvan mitat, origopiste ja pikselitiheys säilyvät. Lappu sisältyy PNG- ja paperin vektorivienteihin; Rollin viimeinen työpala voi pidentyä tai saada yhden lyhyen lisäpalan. Leikkuuohje on erillinen SVG, joka jättää säädetyn levyisen kiinnikkeen paikalliseen vasempaan reunaan. Sitä ei lisätä piirtävän G-koodin liikkeiksi. Paperikulutus sisältää laput sekä lämpötulostimen erillisen, säädettävän leikkurisyötön arvion. Arkkien tiedostoille ei lasketa rullasyöttöä.

TM-T88V:n osittainen katkaisu jättää valmistajan mukaan yhden kiinnikkeen vasemmalle. Sen leveyttä ei voi säätää ohjelmasta. Print-palvelun /api/strip-jobs hyväksyy valinnaisen tearAtRow-rivin: yksi jonotyö lähettää kuvan, GS V 66 0 -osakatkaisun, lapun ja lopullisen katkaisun. Leikkurin siirtymä aiheuttaa tyhjää paperia ennen lapun painatusta. Cut guide bridge vaikuttaa erilliseen SVG-ohjeeseen; Extra cutter feed on materiaalivara, ei laitteeseen lähetettävä etäisyys. Vanha palvelu hylätään ennen uuden päätylappupyynnön lähettämistä. Yksi suikale ja käyttäjän käynnistämä seuraava suikale ovat yhä oletus.

Valmistajan lähteet: [TM-T88V Technical Reference Guide](https://download4.epson.biz/sec_pubs/bs/pdf/TM-T88V_trg_en_revG.pdf) ja [GS V -komento](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_cv.html).

Toistettava esimerkki: [surface-context-assembly.muusia.json](examples/surface-context-assembly.muusia.json). Surface Contextin Paper # ohjaa Gridin pystyviivoja: neljä paperia tuottavat 1/2/3/4 viivaa. Uudet tarkistukset: validate-surface-context, validate-surface-content ja validate-surface-assembly; myös ryhmien oikea moottorikonteksti sekä leikkurijonon virhetilanteet tarkistetaan.

## Reunojen väliset kulmamerkinnät (2.184)

Kokoamis-PDF:n yleiskuvaan sekä editorin esikatseluun on lisätty kulmakaaret ja asteet suoraan paperien näkyviin reunakohtaamisiin. Valinta on **Edge angle arcs + degrees · preview / PDF**. Se tallentuu projektiin, on oletuksena käytössä ja toimii yhteisessä editorissa kaikille paperiperheille.

Kulmakaari mittaa kaaren osoittamien kahden paperireunan välistä näkyvää avautumiskulmaa. Se voi olla eri kuin paperien rotaatioiden erotus, sillä kohtaamisessa voi olla pitkittäinen ja poikittainen reuna. J-tunniste sekä paperinumerot yhdistävät kaaren selitteen reunatunnuksiin AB/BC/CD/DA. Kuvakaappauksen asettelussa merkinnät ovat 87,4°, 97,1°, 28,9°, 92,6°, 61,1° ja 144°. Paperien rotaatioiden etumerkillinen erotus on edelleen paritaulukossa.

Geometria huomioi näkyvyyden ja kerrosjärjestyksen: päällimmäinen paperi peittää taakse jäävät reunat, alempi taustapaperi ei peitä näkyviä saumoja. Erillisten tai yhdensuuntaisten paperien väliin ei keksitä leikkauspistettä, eikä tasaiselle 180 asteen reunalle piirretä kulmaa. Merkinnät päivittyvät muokkauksen päätyttyä. PDF:n kulmalapuissa on johtoviivat ja törmäyksiä välttävä sijoittelu; yli kuusi kohtaa saa lisäksi täydellisen kulmapistetaulukon. Fyysiset tulostus-/vektoritiedostot säilyvät merkinnöistä riippumattomina.

Uusi laskentatiedosto: `src/surface-angles.js`. Kuusi kohdennettua testiä sekä runsaan kulmamäärän PDF-testi sisältyvät 93 läpäisseen testin kokonaisuuteen. Oikeassa selaimessa tarkistettiin kulmien poiskytkentä, rotaation vaikutus, Undo ja täsmällinen projektin Save/Load/Save. Päivitetyn PDF:n kaikki seitsemän sivua renderöitiin ja tarkistettiin.

## Mitattu päätylapun lisäsyöttö (2.185)

Käyttäjän 13.11.2026 toimittamassa IMG_3525.jpeg-kuvassa alun paperireunasta viivan alkuun on 23 mm, viivan lopusta osakatkaisuun 2 mm (vihreä väli), ja osakatkaisusta lapun ensimmäisen tekstin yläreunaan 18 mm. Koetulosteen viiva alkaa asettelussa 8 mm:n kohdalta ja lapun teksti 3 mm:n kohdalta. Molemmat havainnot antavat siksi noin 15 mm tyhjää syöttöä ennen seuraavan rasterin alkua.

Sisäisen repäisykatkaisun lisäpaperiksi saadaan noin **2 + (18 − 3) = 17 mm**. Uusi Extra cutter feed -oletus on 17 mm. Se on kuvasta johdettu arvio kyseiselle Epsonille; lapun pituus ja tavallinen suikalekohtainen 20 mm:n alku-/loppukatkaisuvara lasketaan erikseen. Tallennetun projektin omaa arvoa ei ohiteta automaattisesti. Aktiivisen Strips-koeprojektin arvoksi asetettiin käyttöliittymässä 17 mm. Mittaustiedot ja laskut ovat tiedostossa `docs/MUUSIA-EPSON-END-LABEL-CALIBRATION.json`.

Fyysinen alkuvara (noin 15 mm) ja kuvan jälkeinen 2 mm:n katkaisuvara jäävät varsinaisen teosrasterin mittojen ulkopuolelle. Kokoamisessa ylimääräinen syöttöpaperi siistitään teoksen mittoihin. Graafin, kuvan tai kokoamiskulmien mittakaavaa ei muutettu. Päätylapun vasemman reunan kiinnike on aiemmin vahvistettu; kiinnikkeen tarkkaa leveyttä tai koko paperipalan kokonaispituutta ei tästä mitattu.

## Julkinen julkaisu 13.11.2026

Versio 2.185 on käytössä osoitteessa https://bambi8000.github.io/Muusia/ . Lähdecommit `9d5624e4146c330a21fc24b2e9e12ebee462ae22`, onnistunut Pages-ajo `43397200074`. Julkisesta sovelluksesta kokeiltiin kaikkia kolmea paperiperhettä, paperikohtaista sisältöä, kuutta kulmamerkintää, 17 mm:n lisäsyöttöasetusta ja oletusta tulostaa vain yksi suikale. Oikeat kokoamis-PDF- ja PNG-viennit tarkistettiin. Julkisen sovelluksen sisältö vastaa tavulleen paikallista tarkistettua tuotantoversiota. Uutta fyysistä tulostetta ei lähetetty.
