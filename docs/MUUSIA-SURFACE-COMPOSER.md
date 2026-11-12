# MUUSIA Surface Composer arkkitehtuuri ja toteutussuunnitelma

Päiväys: 12.11.2026. Vaihe 1 ja prototyypin geometriaydin ovat valmiit. Surface Composeria ei ole vielä kytketty käyttöliittymään.

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
| Kuittitulostus | [thermal-print.js](../src/thermal-print.js), [server.py](../print-server/server.py) | Käytä jatkossa nykyistä palvelinta ja jonon periaatetta. Pitkien töiden sopimus laajennetaan erikseen; nykyinen kuittivienti ei ole mittatarkka suikalevienti. |

`sliceMega`, `sliceRoll`, `buildZip`, `toSVG`, `toDXF` ja `ZoomBox` ovat katselmuksessa paikallisesti samat kuin haetussa origin/main-versiossa. `PathsSVG` ja kuittitulostuksen ympäristö ovat muuttuneet, joten niiden toteutuksessa käytetään uusinta lähdettä.

Mega Canvasin ja Roll Moden leikkausfunktioissa on keskenään toistuvaa suorakulmioleikkausta. Niitä ei ensimmäisessä prototyypissä tarvitse purkaa tai korvata: uudelle suikaleelle riittää koordinaattimuunnos ja olemassa oleva `cropTestPiece`. Yhteinen leikkausydin voidaan myöhemmin irrottaa erillisessä muutoksessa, jos sille syntyy todellinen tarve. Vanhojen leikkainten nykyinen polkumetadatan käsittely ei myöskään ole uuden toiminnon malliksi yhtä kattava kuin `cropTestPiece`.

## Tulostusmitat ja nykyiset rajat

Paperin fyysinen leveys, tulostusalue ja paperien välinen rako tallennetaan erikseen. Prototyypin sommitteluoletukset ovat 80 mm paperi, alustava 72 mm tulostusalue ja 8 mm fyysinen rako. Tulostusalueella on erillinen vasemman reunan offset; sitä ei oleteta kaikissa laitteissa keskelle.

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

Askel 1 on toteutettu ja tarkistettu muuttamatta nykyisiä Mega Canvas- tai Roll-viejiä. Seuraava kooditehtävä on askel 2: viiva- ja rasterilähteen yhteinen sijoitus teospinnalle sekä rasterin Image Mapping. Sen jälkeen kytketään graafin yhteinen teospinta ja visuaalinen editori.

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

Geometrian, editorin ja rasteriviennin jälkeen lisätään Fan, Radial, Progressive Rotation ja seeded Random. Presetit tuottavat samoja muokattavia suikaleobjekteja. Independent Content arvioi sisältöä paikallisissa mitoissa suikaleen sijainnin, kulman ja tunnisteen perusteella; Image Mapping pysyy koko teoksen yhteisenä sisältönä.

Tuotantovaiheessa lisätään asennuskartta, käyttäjän säädettävä tulostusjärjestys, laitekohtainen pituusraja sekä pitkien ESC/POS-töiden laajennus nykyiseen palvelimeen. Nykyisiä 256 rivin komentolohkoja voidaan hyödyntää, mutta työraja, tiedonsiirto, jonotus ja keskeytys suunnitellaan koko pitkälle suikaleelle. Leikkaus tehdään vasta fyysisen suikaleen lopussa, ei jokaisen rasterilohkon välissä. Asennuskartta käyttää täsmälleen samoja paperikulmia ja z-järjestystä kuin editori.

Materiaalimäärä on valittujen suikaleiden fyysisten pituuksien summa. Tuotannon tunniste-, syöttö- ja leikkuuvarat lisätään erikseen. Tulostusaika näytetään vasta, kun laiteprofiilissa on perusteltu nopeusarvio; grafiikka ja lämpö vaikuttavat siihen. G-code sallitaan vain viivasisällölle sopivalla koneprofiililla ja työalueella; pitkä lämpöpaperisuikale ei yksin tarkoita, että piirturi voi ajaa sen yhdessä osassa.

## Tehdyt tarkistukset ja jatkaminen

Nykyiset `validate-mega-roll.mjs`, `validate-slicemega.mjs` ja `validate-preview-crop.mjs` ajettiin sekä paikalliselle koodille että haetun origin/mainin lähteistä eristetylle tilapäiskopiolle. Kaikki läpäisivät. Roll-tarkistus kattoi 14 tapausta, mukaan lukien 2000 mm jatkuvuuden, lyhyen viimeisen osan, Gap/Overlap-erot ja suljettujen polkujen leikkauksen. Nämä osoittavat nykyisen perustan; uusia suikaleominaisuuksia ne eivät vielä testaa.

Alkuperäisessä arkkitehtuurikatselmuksessa ei muutettu sovelluskoodia. Geometriavaihe lisäsi erillisen moduulin ja sen tarkistukset; nykyistä käyttöliittymää, graafin arviointia tai viejiä ei muutettu eikä selainprototyyppiä vielä ole. Dokumentaatiolle tarkistetaan linkit, työtilatietojen JSON ja diffi. Sovellustoteutuksen integraatiossa ajetaan rajattujen tarkistusten jälkeen [MUUSIA-AGENTS.md](MUUSIA-AGENTS.md):n yhteinen portti. `sliceMega`, `sliceRoll`, viennit ja useat tilamuuttujat kuuluvat [Learn-vientitodennuksen](../learn/lib/export-provenance.mjs) seuraamiin lähdealueisiin: niiden muutos edellyttää aitoja uusia selainvientejä ja tarvittaessa lähdevalitsinten päivitystä samassa integraatiossa.
