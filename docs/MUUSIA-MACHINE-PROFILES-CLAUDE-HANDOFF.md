# Muusia: koneprofiilit ja ensimmäisen piirron opastus — handoff Claudelle

Päiväys: 29.9.2026. Tarkistettu Muusia v2.106:n nykyisestä työpuusta.

## Tavoite

Daniel haluaa Muusia Learn -sivustolle englanninkielisen opastuksen koneprofiilin rakentamiseen. Vaihtoehtona tai sen rinnalla Muusiaan voisi lisätä valmiit profiilit AxiDraw- ja Bantam-piirtureille. Claude vastaa Muusian varsinaisesta kehityksestä; tämä dokumentti siirtää tarpeen, nykytilan havainnot ja ehdotuksen toteutuksesta. Tässä työssä ei ole toteutettu uusia laiteprofiileja.

Rajaa ensimmäinen toteutus työnkulun valintaan ja profiilin metadataan. Sen rinnalla Learn-opas auttaa käyttäjää sijoittamaan paperin ja tekemään oman laitteensa vaatimat asetukset oikeassa ohjelmassa. Valmiit tarkistetut mallipohjat ja tunnistettavat SVG-layerit ovat seuraava erillinen vaihe; mikään pohja ei korvaa kynän korkeuden ja paperin sijoittelun säätämistä.

Tässä **Bantam tarkoittaa oletuksena Bantam Tools NextDraw -piirtureita**. Varmista tämä ennen laitekohtaisen toteutuksen lukitsemista. CNC-jyrsimet ja muut Bantam-tuoteperheet eivät kuulu tähän ehdotukseen.

## Oleellinen toteutusero

Muusian nykyinen koneprofiili ohjaa ensisijaisesti G-code-vientiä ja siihen liittyvää sijoittelukuvaa. Muutamat kalibroivat nodet lukevat myös profiilin koordinaattitietoja. Servo-vaihtoehto tuottaa Klipperin `SET_SERVO`-komentoja; muutkin lisätoiminnot sisältävät Klipper-kohtaisia komentoja. Pelkkä profiilin nimi ja työalueen muuttaminen eivät toteuta AxiDraw- tai NextDraw-tukea.

AxiDraw'n ja NextDraw'n valmistajan CLI-työkalujen perustoiminto on SVG-tiedoston piirtäminen. Suositeltu ensimmäinen toteutus on siksi **Muusia → SVG → valmistajan ohjelmisto**. Tämä on ehdotus nykyisen viennin ja valmistajan dokumentaation perusteella; Muusian nykyisen G-code-viennin yhteensopivuutta näiden laitteiden kanssa ei ole osoitettu. Lähteet: [AxiDraw CLI](https://axidraw.com/doc/cli_api/) ja [NextDraw CLI](https://bantam.tools/nd_cli/).

Pidä käyttöliittymässä selkeänä, tuottaako valittu profiili G-codea vai valmisteleeko se SVG:n ulkoiselle piirto-ohjelmalle. Suora USB-ohjaus tai uusi paikallinen palvelu on erillinen jatkokehitystyö.

## Nykyinen toteutus: lähdekoodista tarkistetut kohdat

Tarkistettu 29.9.2026. Rivinumerot koskevat nykyistä työpuuta; etsi tarvittaessa funktion nimellä. Tämä on toteutusohje, ei ilmoitus jo lisätyistä laiteprofiileista.

| Kohta | Nykyinen toiminta ja toteutusaukko |
| --- | --- |
| `src/App.jsx:887`, `toGcode` | Soveltaa origon ja Flip Y:n, nostotavan, nopeudet ja alku-/loppukomennot. Servo tuottaa `SET_SERVO`-komentoja; kierto ja huoltoparkki käyttävät Klipper-lisäkomentoja. Profiilin nimi ei ratkaise vientimuotoa. |
| `src/App.jsx:896` ja `:1067`, vientirajat | Canvas-ylitys lisää kommentin. Valmiiden G0–G3-rivien X/Y-tarkistus lisää kommentit ja `M117`-viestin; tiedosto syntyy silti. Tämä ei ole pysäytys, liikeradan leikkaus tai ohjaimen makrojen täydellinen tulkinta. |
| `src/App.jsx:1099`, `toSVG`; `:1130`, `toDXF` | SVG sisältää millimetrisivun ja kynäkohtaiset tavalliset `<g>`-ryhmät; ei Inkscape-layereita. Serialisoija ei sovella koneprofiilin origoa tai Flip Y:tä. DXF tekee oman Y-akselimuunnoksensa. |
| `src/App.jsx:1782`, `DEFAULT_MACHINE`; `:1797`, `DEFAULT_MACHINE_B` | Nykyiset A/B-pohjat ovat projektin servo-/bed-Z-koneille. Ne sisältävät homingin, loppuliikkeen, Klipper-lisäasetukset ja projektikohtaisen Moonraker-osoitteen. Uusi SVG-pohja ei saa periä näitä. |
| `src/App.jsx:1834`, `exportMachine`; `:1841`, `importMachine` | Erillinen tiedosto on `{ app: "muusia-machine", v: 1, prof }`. Tuonti hyväksyy myös paljaan olion, ei validoi työnkulkua tai formaattiversiota, ja yhdistää kaiken `DEFAULT_MACHINE`-arvoihin. Plus kopioi nykyisen profiilin (`:1851`). |
| `src/App.jsx:1914`, `ctx.machine` | Profiilitieto välittyy myös nodeille. Single Marker käyttää sitä DRO-koordinaateissa (`src/defs/nodes/singlemarker.js:34`), Image Underlay kalibroinnissa (`src/defs/nodes/image_underlay.js:50`). Siksi älä väitä, ettei profiili voisi vaikuttaa SVG:hen koskaan: varsinainen SVG-serialisoija ei tee profiilimuunnosta, mutta node voi jo tuottaa profiiliin sidottua geometriaa. |
| `src/App.jsx:2524`, `exportPS`; `:2569`, tavallinen vienti | Optimize route on aluksi päällä. Tavallinen G-code/SVG/DXF ja Mega Canvas käyttävät tätä reittivalintaa. Vientipainikkeet eivät tarkista profiilin työnkulkua. |
| `src/App.jsx:2557`, `megaPreview`; `:2572`, `downloadMega`; `:2695`, `exportAllFrames` | Mega/roll tekee tiedostoja osille; animaatio omat tiedostot freimeille. Kaikissa G-code käyttää aktiivista profiilia. Pelkän tavallisen vientipainikkeen muuttaminen ei sulje muita reittejä. |
| `src/stack-view.jsx:136`, `StackView`; `:203`, `penSheets`; `:234`, `exportZip`; `src/App.jsx:4263` | Oletustila on Frames. Pens jakaa kynäindeksin mukaan; piilotus vaikuttaa vain esikatseluun. Marginaali, Mirror, Numbers ja Drill marks muuttavat vietyä geometriaa/sivua. Stack saa `primaryPS`:n, joten tavallisen viennin `exportPS`/Optimize route ei käsittele sitä. G-code-painike on myös Stackissa (`src/stack-view.jsx:460`). |
| `src/App.jsx:2755`, `buildPatchJSON`; `:2772`, `loadPatch` | Patch tallentaa `prof`, `machines`, `machineIdx`. Ei-tyhjä `machines` korvaa listan; muuten `prof` korvaa sen yhdellä profiililla. Jos molemmat puuttuvat, nykyiset profiilit säilyvät. Molemmat tuontihaarat käyttävät nyt samaa legacy-default-yhdistämistä. |
| `src/App.jsx:2816`, `DKEY` / `setDefaultPatch` | Set default tallentaa koko patchin selaimeen ja palauttaa sen seuraavalla käynnistyksellä. Profiilieditointi on muuten React-tilaa, ei automaattinen pysyvä profiilikirjasto. |
| `src/App.jsx:2947`, `profNum`; `:3733`, MACHINE SETUP | Kaikille profiileille näkyvät samat kentät. Numerosyötteet käyttävät `+value || 0`, eivät varmista positiivisia työalueita tai muita konekohtaisia rajoja. Tuonti/vienti/kopiointi ovat jo olemassa. |
| `src/App.jsx:3767`, canvas-on-bed-kuva | Piirtää canvasin työalueen päälle ja tarkistaa canvasin suorakulmion. Ei mittaa todellista konetta, nodejen kaikkia polkurajoja tai SVG-kohdeohjelman lopullista sijoittelua. |
| `src/App.jsx:1186`, `SimView`; `:1354`, `PathsSVG` | Näyttävät piirron polut, suunnat, siirtymät ja mahdolliset apuviivat. Simulate ei suorita tai tulkitse generoituja G-code-komentoja eikä varmista nostokorkeuksia. |
| `src/App.jsx:2966`, `DroPanel`; `src/dro.jsx:48` ja `:89` | Nykyinen DRO on Moonrakerin lukevan tilauksen kautta saatava sijaintinäyttö. Se lähettää `printer.objects.subscribe`, ei piirto-/homing-komentoja. On/off-valinta tallentuu erikseen, ja päällä oleva näkymä yhdistää profiilin URL:ään. SVG-profiili ei saa periä tätä osoitetta tai yhteydenottoa. |

Lue myös `docs/MUUSIA-HANDOFF.md` ja `docs/MUUSIA-LEARN-PLAN.md`. Säilytä jo tehdyt Learn-muutokset. Muusian käyttöliittymä ja oppaat ovat englanniksi, kehityskeskustelu suomeksi.

## Vaihe 1: rajattu työnkulkuvalinta ja profiilin tallennus

**Ensimmäinen toimitus on profiilin työnkulkumetadata, sitä vastaava käyttöliittymä ja yhteensopiva tallennus.** Nykyinen SVG ja Stack → Pens → SVG .zip riittävät SVG-haaran tiedostoiksi. Älä lisää tässä vaiheessa laiteohjausta, uutta G-code-dialektia, ajuria, verkkopalvelua, automaattista kynänvaihtoa tai valmistajan säätöjen lähettämistä. Yhden SVG:n layer-tuki on alla erillinen vaihe 2.

### Tietomalli ja oletukset

Lisää eksplisiittinen työnkulku, esimerkiksi `workflow: "gcode" | "svg-external"`. Valmistaja ja malli ovat kuvaavaa metadataa, eivät komentogeneraattorin valitsin. Uuden pohjan pienin hyödyllinen tietosisältö:

| Kenttä | Vaiheen 1 merkitys |
| --- | --- |
| `workflow` | `gcode` säilyttää nykyisen vientikäytöksen; `svg-external` tarkoittaa SVG:n avaamista erillisessä piirto-ohjelmassa. |
| `id`, `name` | Vakaa profiilitunniste ja käyttäjän muokattava nimi. Kopiointi tuottaa uuden tunnisteen. |
| `manufacturer`, `model` | Valinnainen laitetieto; ei automaattista yhteyttä tai yhteensopivuuslupausta. |
| `units`, `workW`, `workH` | Millimetrit ja tarkistetut liikealueen mitat. Tuntematon alue näkyy tuntemattomana, ei vanhan A-profiilin 330 × 240 mm:nä. |
| `sourceUrl`, `verifiedOn` | Valinnaiset pohjan tietolähde ja tarkistuspäivä. Käyttäjän oma profiili merkitään omaksi määrittelyksi; sille ei keksitä valmistajavarmennusta. Pidä kalibrointi erillään valmistajan arvoista. |

Tee SVG-pohja omasta pienestä oletusoliostaan. Älä rakenna sitä `...DEFAULT_MACHINE`-kopiona tai piilotettuna AxiDraw-nimiseksi vaihdettuna servo-/bed-Z-profiilina. Vaiheen 1 voi toimittaa yleisellä **External SVG plotter** -pohjalla: käyttäjä antaa oman mallinsa ja vahvistetun työalueen. AxiDraw-/NextDraw-perheen nimi voi auttaa valitsemaan ulkoisen ohjelman, mutta tarkkoja mallimittoja ei arvailla.

Myöhemmän pohjavalikoiman ehdokkaita ovat AxiDraw V3, V3/A3 sekä NextDraw 8511 ja 1117; NextDraw 2234 voi seurata. Tarkista mallikohtaisesti liikealue, orientaatio ja ohjelmiston mallivalinta ennen arvojen lisäämistä. Virallinen NextDraw CLI erottaa mallit omalla `model`-asetuksellaan; pelkkä tiedoston SVG-sivukoko ei valitse laitetta. [AxiDraw model](https://axidraw.com/doc/cli_api/#model), [NextDraw model](https://bantam.tools/nd_cli/#model).

### Näkyvä käyttäytyminen

- Näytä Machine Setupissa **Workflow: G-code / External SVG** ja lyhyt selitys vientipaikasta. SVG-haarassa näytä nimi, mallitieto, työalue ja ohje ulkoiseen ohjelmaan. G-code-nosto-, servo-, nopeus-, alku-/loppukomento-, laser-, huolto-, kierto- ja Moonraker-kentät eivät ole SVG:n toimivia säätimiä. Älä muunna servoasteita tai mm/min-nopeuksia valmistajan prosenttiasetuksiksi.
- Säilytä SVG:n nykyinen canvas-koordinaatisto. Vaiheen 1 työaluekuva on vain sijoittelun vertailukuva: älä kytke piilossa jääviä legacy-origo-/Flip Y -arvoja vientiin tai esitä kuvan pistettä valmistajan vahvistettuna kotipaikkana. Jos käyttäjä tarvitsee sivun sijoitussiirron SVG:hen, toteuta ja nimeä se erikseen myöhemmin. Säilytä legacy-G-code-profiilien `ctx.machine`-käytös ja testaa myös DRO-koordinaatteihin perustuva Single Marker.
- Keskitä vientityypin tarkistus yhteen käytäntöön, jota kaikki G-code-reitit kutsuvat: tavallinen vienti, animaation freimit, Mega Canvas/roll, Stack ja laser-jigin G-code. SVG-profiililla nämä eivät saa tuottaa legacy-G-codea. Pelkkä nappien piilottaminen ei riitä; vientifunktion pitää myös torjua väärä yhdistelmä. Näytä lyhyt englanninkielinen ohje SVG-vientiin. SVG/DXF:n muu nykyinen toiminta säilyy.
- Profiilin vaihtaminen tyhjentää tai päivittää aiemmin generoidun tiedoston esikatselun, jotta Download/Copy ei tarjoa vanhan G-code-profiilin tulosta SVG-profiilin nimissä. Muista myös jo auki oleva Stack ja kesken oleva freimivienti.
- SVG-profiili ei anna URL:ää DRO:lle eikä käynnistä Moonraker-yhteyttä. Säilytä vanhan G-code-profiilin DRO-toiminto; kyse on lukevasta sijaintinäytöstä. Tässä toimituksessa ei lähetetä laitteelle liike-, homing-, kynännosto- tai laserkomentoja, eikä selain avaa valmistajan USB-yhteyttä.

### Tallennus ja vanhat tiedostot

Tee yksi normalisointi-/validointifunktio erilliselle profiilituonnille, patchin `machines`-listalle, legacy-`prof`-kentälle ja Set default -palautukselle. Sen pitää valita työnkulun omat oletukset ennen yhdistämistä.

1. Puuttuva `workflow` tulkitaan vanhassa v1/paljaassa profiilissa nykyiseksi `gcode`-työnkuluksi. Säilytä omat komennot, numerot ja A/B-käytös; älä nimeä vanhoja tiedostoja jälkikäteen valmistajatuiksi.
2. Eksplisiittinen `svg-external` ei saa periytyviä konekomentoja, verkko-osoitetta tai hiljaista työalueoletusta. Tuntematon työnkulku, virheellinen rakenne ja tukematon formaattiversio hylätään selkeällä viestillä. Puuttuvat SVG-työalueet merkitään asettamattomiksi; annetut mitat validoidaan äärellisiksi ja positiivisiksi.
3. Säilytä patchin nykyinen profiilien valintajärjestys: ei-tyhjä `machines` ensin, muuten `prof`; molempien puuttuessa käyttäjän nykyinen lista pysyy. Rajaa `machineIdx` kelvolliseen kokonaislukuindeksiin myös negatiiviselle tai virheelliselle syötteelle. Älä tyhjennä olemassa olevaa listaa epäonnistuneessa tuonnissa.
4. Määrittele kirjoitettavan profiiliformaatin versio sekä patchin metadatan lisäys ja dokumentoi muutos. Uusi sovellus lukee vanhat tiedostot. Vanha sovellus ei ymmärrä uutta työnkulkurajoitusta: nykyinen lukija ohittaa version ja voisi yhdistää SVG-profiilin legacy-oletuksiin. Älä lupaa uuden SVG-profiilin turvallista käyttöä vanhassa Muusiassa; merkitse vähimmäisversio näkyvästi.
5. Tuonti/vienti, kopiointi, patchin Save/Load ja Set default säilyttävät työnkulun ja metadatan. Kerro käyttäjälle milloin asetukset ovat vain nykyisessä istunnossa, erillisessä profiilitiedostossa, patchissa tai selaimen oletuspatchissa. Uusi automaattinen profiilikirjasto ei kuulu tähän vaiheeseen.

## Vaihe 2: monivärisen SVG:n yhteensopivuus

**Yhden SVG:n tunnistettavat kynälayerit ovat vaihe 2.** Vaihe 1 käyttää olemassa olevaa tavallista SVG:tä ja tarvittaessa per-pen-ZIP:iä. AxiDraw'n ja NextDraw'n monivärinen työ piirretään tavallisesti kynäkerros kerrallaan, fyysinen kynä vaihtaen. Valmistajan Layers-tila valitsee piirrettävät kerrokset; oletusarvoinen Plot-tila piirtää kaikki näkyvät kerrokset. Näytön punainen viiva ei siis itsessään käynnistä kynänvaihtoa. [AxiDraw Layers](https://axidraw.com/doc/cli_api/#layers), [NextDraw Layers](https://bantam.tools/nd_cli/#layers).

Tarkista nykyinen SVG ulkoisessa piirto-ohjelmassa. Muusian värillinen `<g>`-ryhmä ei yksin ole valmistajan tunnistama piirrettävä layer. Molemmat käyttävät Inkscape-yhteensopivia `inkscape:groupmode="layer"`- ja `inkscape:label`-attribuutteja sekä nimiavaruutta. Tee kustakin kynästä oma ylimmän tason layer; sisäkkäinen ryhmä ei riitä Layers-tilan valintaan. Kerroksen nimen alussa oleva numero toimii valintana. [AxiDraw Layer Control](https://wiki.evilmadscientist.com/AxiDraw_Layer_Control), [NextDraw Layer Control](https://support.bantamtools.com/hc/en-us/articles/29473928061971-NextDraw-Layer-Control).

Suositeltu vienti ja ohje:

1. Käyttäjä valitsee Muusiassa lopullisen Merge-noden ja vie yhden kerroksellisen SVG:n. Säilytä kynäjako kynäindeksin perusteella, vaikka kahdella kynällä olisi sama näyttöväri.
2. Näytä vientiyhteenveto: käytetyt Muusia Pen -numerot/nimet, vastaavat SVG-layerit ja piirtojärjestys. Ehdotus vakaaksi numeroinniksi on SVG-layer = Muusia Pen + 1, jolloin myös Pen 0 saa positiivisen kerrosnumeron. Esimerkiksi Pen 1 Blue → `2 — Muusia Pen 1 — Blue`. Merkitse vastaavuus selvästi ja testaa se, älä muuta Muusian omia kynäindeksejä.
3. Käyttäjä avaa tiedoston valmistajan ohjelmaan, valitsee sinisen kerroksen, asentaa sinisen kynän ja piirtää sen. Sitten hän vaihtaa punaiseen kynään ja piirtää punaisen kerroksen.
4. Paperi ja piirturi pysyvät paikoillaan. Sivukoko, mittakaava, orientaatio ja lähtöpiste säilyvät samoina kaikille kerroksille. Kynä vaihdetaan siirtämättä piirtoa suhteessa paperiin; erilaisten kynien kärjen sijainti ja korkeus tarkistetaan.

Vaihtoehtoinen vienti on **yksi SVG per kynä yhtenä ZIP-pakettina**. Tämä on jo olemassa: valitse koko piirros → **Stack → Pens → SVG .zip** (`src/stack-view.jsx:203–245`). Stack avautuu oletuksena Frames-tilaan, joten Pens-valinta pitää kertoa. Tavallista moniväristä paperipiirtoa varten käytä asetuksia Sheet margin 0, Mirror off, Numbers off ja Drill marks Off. Muut arvot voivat lisätä marginaalin, peilauksen tai piirrettäviä merkkejä. Stackin näkyvyyspainikkeet muuttavat vain esikatselua, eivät vientivalintaa.

Kaikissa väritiedostoissa pitää säilyä täsmälleen sama sivukoko, viewBox, koordinaatit ja yhteinen sijoittelu. Älä rajaa tai keskitä jokaista väriä erikseen. Nykyiset nimet `sheet01.svg`, `sheet02.svg` tarkoittavat käytettyjen kynien järjestystä, eivät Muusian kynänumeroita: esimerkiksi Pen 0 ja Pen 3 tuottavat kaksi tiedostoa järjestysnumeroilla 01 ja 02. Lisää vientiyhteenvetoon tai tiedostonimeen yksiselitteinen kynänumero ja nimi. Tämä nykyinen ZIP-vienti tarjoaa heti dokumentoitavan polun samalla kun yhden SVG:n layer-tukea parannetaan. Ulkoisen ohjelman esikatselu ja fyysinen kohdistustesti ovat silti erillisiä varmennuksia.

Automaattisesti pyydetty kynänvaihtotauko on jatkovaihtoehto. Molempien dokumentoima kerrosnimen alun `!` pysäyttää piirron ja nostaa kynän, mutta ei palauta kelkkaa kotiasemaan. Fyysinen kynä vaihdetaan edelleen käsin, ja jatkaminen pitää testata oikealla Resume-työnkululla. Älä lupaa automaattista kynänvaihtoa tai lisää taukoa ennen ensimmäistä piirrettävää kerrosta. Aloittelijan pääpoluksi riittää erikseen valittu kerros kerrallaan. [AxiDraw-tauot](https://wiki.evilmadscientist.com/AxiDraw_Layer_Control#Syntax), [NextDraw-tauot](https://support.bantamtools.com/hc/en-us/articles/29473928061971-NextDraw-Layer-Control).

Lisää Learniin konkreettinen jatko nykyiselle kahden kynän tutoriaalille: **“Plot two colours with AxiDraw / NextDraw”**. Käytä samoja sinisiä aaltoja ja punaisia renkaita. Näytä oikea SVG-kerroslista, yhden kerroksen valinta ja lopputuloksen kohdistus. Merkitse ruutukuvan laitemalli ja käytetty piirto-ohjelma.

**Toteutettu jatko 29.9.2026:** Learnin neljäs opas **“Export a two-colour SVG set”** dokumentoi jo nykyisen Stack → Pens → SVG .zip -polun. Mukana ovat oikeat Stack-kuvat, asetustaulukko, yhteisen sivukoon/kohdistuksen ohje, tiedostojen kynävastaavuus ja oikeasta Muusiasta ladattu vertailupaketti. Älä toteuta tätä opasta uudelleen. Valmistajakohtaiset käyttöliittymäkuvat, yhden SVG:n tunnistettavat layerit, laiteprofiilit ja fyysinen koepiirto ovat edelleen jatkotyötä.

**Travel Sort ja SVG/DXF:** opasta, että Travel Sort ei muuta viedyn piirroksen ulkonäköä eikä näihin tiedostoihin tallenneta kynä ylhäällä tehtävien siirtymien ajokomentoja. Älä kuitenkaan kirjoita, ettei node vaikuta vientiin lainkaan: nykyiset vientifunktiot saavat valitun noden polut, joten järjestys, avoimen polun suunta ja suljetun polun aloituspiste voivat muuttua myös tiedostossa. SVG ryhmittelee polut lisäksi kynittäin. Muusian Optimize route voi järjestää polut uudelleen ennen vientiä, ja vastaanottava piirto-ohjelma päättää lopullisen ajoreitin. Vastaanottavan ohjelman reittiesikatselu ja optimointiasetukset pitää siksi käsitellä SVG/DXF-ohjeessa.

## Learn 07 on yhteinen hyväksymisesimerkki

Tällä Learn-kierroksella lisätään **“Prepare your first physical plot”** (`id: first-physical-plot`, `assetKey: physical-plot`), jolloin kokonaisuus sisältää seitsemän opasta ja kahdeksantoista node-esittelyä. Säilytä tämä opas ja sen oikeat Muusia-kuvat; älä toteuta samaa sisältöä uutena rinnakkaisena oppaana. Uusi opas dokumentoi ensin nykyisen sovelluksen rajan: SVG viedään ulkoiseen ohjelmaan, nykyinen MACHINE SETUP koskee G-code-työnkulkua, ja valmistajakohtainen profiili on vielä erillistä kehitystä. Opas ei väitä fyysisen piirron olevan jo testattu.

Käytä oppaan pientä epäsymmetristä testipiirrosta regressio- ja käyttöönottoesimerkkinä:

- Patch: `learn/examples/tutorial-physical-plot.muusia.json`; vertailuvienti: `learn/examples/physical-plot.svg`. SVG-vertailu ladataan oikeasta Muusian käyttöliittymästä; sen alkuperä kirjataan erilliseen export-manifestiin.
- A4 landscape, 297 × 210 mm. Viisi nodea: Container (20 × 20 mm neliö), Container (epäsymmetrisen suunnan osoittava kolmio), Grid → Move / Scale (kolme erillistä viivaa), Merge (kolme tuloa, Pen change per input off). Valittava ja vietävä tulos on Merge, kaikki polut Pen 0 · Black.
- Lopputulos on viisi polkua: kaksi suljettua muotoa ja kolme avointa viivaa. Neliön reunat ovat x/y 20–40 mm; kokonaispiirros sijoittuu noin x 20–79,7 mm ja y 20–60,5 mm. Mitat ovat piirrosgeometriaa, eivät laitteen oletuksia.

Tarkat parametrit ovat `learn/content.mjs`-, `learn/lib/fixtures.mjs`- ja manifestitiedostoissa. Älä tee kuvauksen perusteella toista likimääräistä piirrosta. Sama ladattava patch ja siitä viety SVG ovat molempien työnkulkuhaarojen yhteinen lähtökohta.

**Valmista ajettavaa G-code-tiedostoa tai käyttäjän koneelle kalibroitua profiilia ei sisällytetä oppaaseen**, koska laitemallia ja ohjainta ei ole annettu. G-code-haara näyttää nykyiset asetusten nimet ja tiedoston generoinnin; kuvassa näkyvä demoprofiili ei ole yleispätevä nosto-/nopeussuositus. Oikeat nostokorkeudet, suunnat, työalue ja komennot varmistetaan käyttäjän laitteelle. Laitteelle ei lähetetä mitään tämän toimituksen varmennuksissa.

Vaiheen 1 yhteydessä päivitä vain muuttuvat kohdat: uusi Workflow-valinta, profiilin nimeäminen/tallennus, SVG- ja G-code-haarojen todelliset asetukset sekä virhetilanteet. Ota muuttuneesta Machine Setupista uudet aidot kuvakaappaukset ja päivitä niiden manifesti. Säilytä aloittelijan vaiheistus ja kokeneen käyttäjän asetustaulukko. Muusian canvas-on-bed-kuva, Show direction ja Simulate ovat ohjelman esikatseluja, eivät laitekalibrointia tai G-code-ohjaimen simulaatioita.

## Vaiheen 1 hyväksymiskriteerit

| Tarkistus | Vaadittu tulos |
| --- | --- |
| Vanhojen profiilien regressio | Nykyinen A/B, v1-konetiedosto, paljas legacy-profiili ja vanha patch toimivat kuten ennen. Käyttäjän omat alku-/loppukomennot ja mitat säilyvät. Profiilittoman Learn-patchin lataus ei korvaa koneita. |
| Uuden SVG-profiilin round trip | Tuonti/vienti, kopiointi, Save/Load ja Set default säilyttävät metadatan. Ei periytyviä Klipper-komentoja, Moonraker-URL:ää tai oletettua 330 × 240 mm:n laitealuetta. Tuntematon tyyppi, versio, mitat ja indeksi käsitellään määritellysti. |
| Kaikki vientireitit | SVG-profiili ei tuota G-codea tavallisen viennin, animaation, Mega/rollin, Stackin tai jigin kautta. Auki oleva vanha tulos ei ohita tarkistusta Download/Copylla. Legacy-G-code toimii edelleen. |
| Geometria ja esikatselu | Lesson 07:n fixture antaa muuttumattoman SVG-sivukoon, viewBoxin ja polut ennen/jälkeen työnkulkumetadatan. Työaluekuva ja apuviivat pysyvät esikatseluina. Rajavaroitusta ei esitetä koneen mittauksena tai automaattisena ajon pysäytyksenä. |
| Yhteydet | SVG-profiilin valinta ei avaa verkkoyhteyttä tai USB:tä. Legacy-DRO on edelleen lukevan tilauksen toiminto; uusia toimilaitteen ohjauksia ei synny. |
| Learn ja ohjelmistotestit | Lesson 07:n sanat, kuvat ja tiedostot vastaavat toimintaa. Aja `npm run build`, `npm run check:learn` sekä profiilin normalisoinnin, tallennuksen ja vientirajoitusten kohdistetut testit. |

Vaiheen 1 metadata voidaan hyväksyä lähde-, tiedosto- ja käyttöliittymätesteillä. **Valmistajan laitemallille varmennetuksi vientipoluksi** nimeäminen edellyttää lisäksi saman SVG:n onnistunutta valmistajan offline-esikatselua oikealla mallivalinnalla. Fyysinen koepiirto on erillinen käyttäjän tekemä varmennus; raportoi sen puuttuminen täsmällisesti eikä koko SVG-työnkulkua valmiiksi laitetestatuksi.

## Valmistajan offline-esikatselu ja vaiheen 2 hyväksyntä

Viralliset AxiDraw- ja NextDraw-CLI:t dokumentoivat `--preview`-tilan ilman USB-liikennettä ja laitteen liikettä. Esimerkkikomennot alla ovat **vain offline-esikatselua**: korvaa `test.svg` lesson 07:stä viedyllä tiedostolla. Käytä vahvistettua mallivalintaa dokumentaation mukaan ja tallenna ohjelmistoversio sekä käytetyt asetukset raporttiin. Tämän dokumentin tarkistuksessa komentoja ei ajettu. [AxiDraw preview](https://axidraw.com/doc/cli_api/#preview), [NextDraw preview](https://bantam.tools/nd_cli/#preview).

```sh
axicli test.svg --preview --rendering 3 --report_time --output_file axidraw-preview.svg
nextdraw test.svg --preview --report_time --output_file nextdraw-preview.svg
```

Kuvakaappauksen pitää osoittaa oikea sivukoko, epäsymmetrisen merkin suunta ja erillisten viivojen siirtymät. Älä poista `--preview`-asetusta osana automaattista varmennusta. Pelkkä SVG:n avaaminen selaimessa ei varmista valmistajan tulkintaa.

Kun vaihe 2 toteutetaan, varmista lisäksi:

- Jokainen kynälayer voidaan valita erikseen, mukaan lukien Muusia Pen 0 ja samaksi näyttöväriksi nimetyt erilliset kynät. Erillisten valintojen yhteistulos vastaa alkuperäistä piirrosta ilman puuttuvia tai toistettuja viivoja.
- Layer-SVG ja vaihtoehtoinen per-pen-ZIP säilyttävät yhteisen sivukoon, viewBoxin ja koordinaatit. Kerrosnumeron ja Muusia Pen -indeksin vastaavuus on yksiselitteinen; `sheet01` ei esiinny kynänumeron lupauksena.
- Tallenna reittioptimoinnin vaikutus kummassakin ohjelmassa. Mahdollinen taukovienti testataan Resume-toiminnolla erillisenä työnä; ei oletusta automaattisesta kynänvaihdosta.
- Erota raportissa lähdedokumentaatiosta varmistettu ominaisuus, ohjelmiston offline-esikatselussa testattu tulos ja oikealla koneella tehty piirto.

Toimita vaihe 1 yhtenä rajattuna muutoksena. Kerros-SVG, mallikohtaiset pohjat ja valmistajan käyttöliittymäkuvat voivat seurata erillisinä muutoksina. Tämä tiedosto on paikallinen handoff: sitä ei ole lähetetty Claudelle eikä sen perusteella ole muutettu Muusian laiteohjausta.
