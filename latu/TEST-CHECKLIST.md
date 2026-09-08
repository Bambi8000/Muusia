# LATU — manuaalinen testauslista

Merkitse kohta valmiiksi vasta, kun sekä toiminto että odotettu tulos toteutuvat. Kirjaa poikkeamat lopun virhetaulukkoon.

## Testiympäristö

- [ ] Testaa ensin uusin paikallinen build: `public/latu/index.html`.
- [ ] Kun muutokset on commitoitu ja pushattu, varmista sama julkaistusta LATUsta: <https://bambi8000.github.io/Muusia/latu/>.
- [ ] Testaa vähintään Chromella tai Edgellä työpöytäkoossa.
- [ ] Varaa servo-Z-fixture `latu/tests/fixtures/servo-z-patch-21.gcode`.
- [ ] Varaa bed-Z-fixture `latu/tests/fixtures/bed-z.gcode`.
- [ ] Varaa tapahtumafixture `latu/tests/fixtures/events.gcode`.
- [ ] Avaa selaimen konsoli ja varmista, ettei sivun lataus tuota virheitä.

## Tiedostot ja round trip

- [ ] `Open` avaa `.gcode`-tiedoston ja näyttää oikean tiedostonimen.
- [ ] Tiedostonimi näkyy heti `Open`-painikkeen vieressä `FILE`-kentässä; piste nimen edessä kertoo tallentamattomista muutoksista.
- [ ] Tiedoston voi pudottaa ikkunaan drag-and-dropilla.
- [ ] `Combine…` tuo yhden tai useita G-codeja nykyiseen dokumenttiin ja säilyttää vetojen määrän.
- [ ] Yhdistetyssä dokumentissa jokainen lähdetiedosto näkyy omana nimettynä `FILE GROUPS` -ryhmänään.
- [ ] Ryhmä säilyy yhtenäisenä G-codessa: eri tiedostojen vedot eivät lomitu keskenään, mutta tiedoston sisäiset pen change -vaihdot säilyvät.
- [ ] Ryhmärivin valitseminen valitsee tiedoston kaikki vedot kaikista kynäosioista.
- [ ] Ryhmää voi raahata canvaksella tai siirtää numeerisilla X/Y-arvoilla yhtenä kokonaisuutena esimerkiksi neljän kuvan A3-asettelua varten.
- [ ] Servo-fixture näyttää 51 vetoa ja kaksi kynäosiota (Black ja Magenta).
- [ ] Bed-Z-fixture tunnistuu bed-Z-ohjelmaksi ja paine-Z säilyy pisteissä.
- [ ] Tuntemattomat rivit näkyvät varoitettuina mutta säilyvät tekstissä.
- [ ] Muokkaamattoman tiedoston `Save as` on tavutasolla alkuperäisen kaltainen.
- [ ] Muokatun tiedoston tallennus lisää vain yhden `edited with LATU` -merkinnän.
- [ ] Tallennus päivittää draw/travel/aika-otsikkotiedot.
- [ ] Tallennus lisää tai päivittää `; LATU profile: <name>` -rivin.
- [ ] Tallennettu tiedosto avautuu uudelleen ilman parserivaroituksia.

## Canvas ja navigointi

- [ ] Vedot näkyvät kynäväreillä ja travel-liikkeet katkoviivoina.
- [ ] `Travels` piilottaa ja palauttaa travel-liikkeet.
- [ ] `Y+ ↑` on oletuksena päällä ja näyttää positiivisen Y-suunnan ylöspäin muuttamatta G-codea.
- [ ] Hiiren rulla zoomaa osoittimen kohdalta.
- [ ] `−` pienentää zoomia näkymän keskeltä.
- [ ] `＋` suurentaa zoomia näkymän keskeltä.
- [ ] `Fit` sovittaa koko piirroksen näkyviin.
- [ ] Zoomilukema päivittyy ja pysyy välillä 0,1–64 px/mm.
- [ ] Pisteen tai vedon siirto zoomattuna ei enää aja automaattista `Fit`-toimintoa: zoom ja panorointi säilyvät.
- [ ] Tavallinen veto tyhjällä alueella panoroi näkymää.
- [ ] Kaksoisklikkaus tyhjällä alueella sovittaa piirroksen näkymään.
- [ ] Canvasin hover korostaa vastaavan G-code-rivin.
- [ ] Vedon/pisteen valinta hyppää oikealle tekstiriville.
- [ ] Outline-rivin valinta korostaa oikean vedon canvaksella.

## Measure-työkalu

- [ ] `Measure` aktivoi mittaustilan ja näyttää käyttöohjeen.
- [ ] Raahaus pisteestä toiseen piirtää turkoosin mittaviivan.
- [ ] Mittalappu näyttää etäisyyden millimetreinä kahden desimaalin tarkkuudella.
- [ ] Mittalappu näyttää etumerkilliset `ΔX`- ja `ΔY`-arvot konekoordinaateissa.
- [ ] Vaakasuoran 100 mm välin tulos on `100.00 mm`, `ΔX ±100.00`, `ΔY 0.00`.
- [ ] Pystysuoran välin tulos säilyy oikein myös `Y axis ↑` -tilassa.
- [ ] Mitta säilyy näkyvissä raahauksen päätyttyä.
- [ ] Uusi raahaus korvaa edellisen mitan.
- [ ] Zoomaus ja panorointi eivät muuta mitan millimetriarvoa.
- [ ] `Esc` poistuu mittaustilasta eikä muuta G-codea.

## Valinta ja geometriamuokkaukset

- [ ] Yhden vedon ja usean vedon valinta toimii; Shift lisää/poistaa valinnasta.
- [ ] `Box select` valitsee laatikon sisällä olevat vedot.
- [ ] Vedon ja yksittäisen pisteen raahaus päivittää G-code-koordinaatit.
- [ ] Shift-klikkaus valitsee useita pisteitä; valitut pisteet näkyvät valkoisina.
- [ ] Kun useita pisteitä on valittu, yhden valkoisen pisteen raahaus siirtää kaikkia valittuja pisteitä yhdessä.
- [ ] Nuolinäppäin siirtää valintaa 0,1 mm; Shift 1 mm.
- [ ] Numeerinen Move näyttää pienet X/Y-tunnukset ja siirtää valintaa annetun määrän.
- [ ] Kun `Y+ ↑` on päällä, positiivinen numeerinen Y-arvo ja ylänuoli siirtävät valintaa näytöllä ylöspäin.
- [ ] Delete poistaa valitun pisteen, vedon tai tapahtuman turvallisena kokonaisuutena.
- [ ] Copy/Paste monistaa valitut kokonaiset vedot.
- [ ] Reverse vaihtaa vedon suunnan muuttamatta geometriaa.
- [ ] `+ Point` lisää keskipisteen oikeaan segmenttiin.
- [ ] Segmentin kaksoisklikkaus lisää pisteen täsmälliseen kohtaan.
- [ ] Split jakaa vedon ja lisää tarvittavan nosto/travel/lasku-rakenteen.
- [ ] Join: valitse Shift-klikkauksella yksi päätepiste kummastakin vierekkäisestä vedosta ja paina `Join endpoints`.
- [ ] Join käyttää juuri valittuja päätepisteitä ja kertoo, jos pisteet eivät ole päätepisteitä tai vedot eivät ole vierekkäisiä.
- [ ] Kauempana olevien päätepisteiden Join onnistuu ja lisää niiden välille näkyvän piirrettävän yhdyssegmentin.
- [ ] Valittu veto voidaan siirtää `Move to pen…` -valinnalla toisen kynän alle; geometria ei muutu.
- [ ] Outline-raahaus järjestää vetoja vain saman kynäosion sisällä.
- [ ] Optimize lyhentää tai säilyttää travel-matkan eikä muuta vetojen määrää.
- [ ] Pen tool luo uuden vedon ja Enter päättää sen; Esc peruu.
- [ ] Undo/Redo palauttaa canvas- ja tekstimuokkaukset oikeassa järjestyksessä.

## Skaalaus ja turvallisuus

- [ ] Uniform scale säilyttää kuvasuhteen.
- [ ] Non-uniform scale näyttää vääristymisvaroituksen.
- [ ] Fit to size noudattaa kokoa ja marginaalia.
- [ ] Rotate kiertää valinnan piirroksen keskipisteen ympäri.
- [ ] Custom anchor käyttää annettua konekoordinaattia.
- [ ] Fit work area sijoittaa koko piirroksen profiilin työalueelle 5 mm marginaalilla.
- [ ] `Canvas size` muuttaa canvasin leveyden, korkeuden ja origon muuttamatta oletuksena G-code-koordinaatteja.
- [ ] `Scale all artwork` skaalaa koko piirroksen uuden canvas-koon ja origon mukaiseksi.
- [ ] Työalueen ulkopuolinen piste tuottaa bounds-varoituksen.
- [ ] G91- tai G20-tiedosto muuttuu turvallisesti vain katseltavaksi.
- [ ] Epätasapainoinen dip/maintenance-lohko tuottaa varoituksen.

## Tapahtumat

- [ ] Pitstop käyttää aktiivisen profiilin pause-komentoa ja viestiä.
- [ ] Auto-pitstop vedon keskellä jakaa vedon sekä nostaa ja palauttaa kynän.
- [ ] Pen change vaihtaa seuraavan osion indeksin, nimen ja värin.
- [ ] Pen up/down käyttää servo-profiilissa oikeaa servonimeä ja kulmia.
- [ ] Pen up/down käyttää bed-Z-profiilissa Z-arvoja ja Z-feediä.
- [ ] Dip cycle syntyy yhtenä atomisena `dip`-lohkona.
- [ ] Maintenance ilman parkkia ja parkin kanssa tuottaa oikeat lohkot.
- [ ] Macro dose tuottaa profiilin `INK_DOSE`-templaten.
- [ ] Raw E dose lisää `M83`:n vain kerran sekä dose- ja retract-rivit.
- [ ] Dose `keep` -tilassa ei nosta kynää vedon keskellä.
- [ ] Air macro ja raw pin -variantit toimivat.
- [ ] Air pre-aim ja sweep lisäävät rotaatiokomennot oikeisiin kohtiin.
- [ ] Brush rotation käyttää profiilin stepperiä, kulmaa ja nopeutta.
- [ ] Laser on/off käyttää profiilin komentoja.
- [ ] Custom snippet korvaa `{X}`, `{Y}` ja `{PEN}` -paikat.
- [ ] Lisätty tapahtuma näkyy heti outlinessa ja canvaksella.
- [ ] Continuous feed lisää valittujen vetojen E-arvot suhteessa segmenttipituuteen.
- [ ] Remove E poistaa jatkuvan syötön ja tarpeettoman LATU-M83-rivin.

## Profiilit

- [ ] Molemmat oletusprofiilit ovat valittavissa.
- [ ] Profiilin luonti, kopiointi, nimeäminen, järjestäminen ja poisto toimivat.
- [ ] Aktiivisen profiilin poisto vaihtaa turvallisesti jäljelle jäävään profiiliin.
- [ ] Kaikki kone-, Z-, feed-, dip-, maintenance-, laser- ja template-kentät säilyvät uudelleenavauksessa.
- [ ] Profiilin Notes-kenttää voi muokata myös Backspace/Delete-näppäimillä.
- [ ] Yhden profiilin JSON-vienti ja takaisin tuonti toimii.
- [ ] Kaikkien profiilien JSON-vienti ja takaisin tuonti toimii.
- [ ] Virheellinen JSON ei hävitä nykyisiä profiileja.
- [ ] Snippet-kirjaston lisäys, muokkaus ja poisto säilyvät localStoragessa.
- [ ] Tiedoston LATU profile -rivi palauttaa oikean profiilin uudelleenavauksessa.

## Playback (M3)

- [ ] Playback avaa aikajanan ja estää geometriamuokkaukset.
- [ ] Play/Pause toimii ja reset palauttaa ajan nollaan.
- [ ] Aikajanaa voi raahata molempiin suuntiin.
- [ ] Nopeudet 1×, 2×, 5×, 10×, 25×, 50× ja 100× toimivat.
- [ ] Valmis rata näkyy täysvärisenä ja jäljellä oleva himmeänä.
- [ ] Työkaluristikko liikkuu oikeaa reittiä pitkin.
- [ ] G4-dwell pysäyttää ristikon oikeaksi ajaksi.
- [ ] Profiilin settle-viive lasketaan, mutta tiedoston oma G4 ei tuplaannu.
- [ ] Pen change näkyy oranssina chapter-merkkinä.
- [ ] Chapter-merkin painaminen hyppää taukoon ja oikealle tekstiriville.
- [ ] Follow text vierittää aktiivista G-code-riviä; `Follow text` -valinnan poistaminen pysäyttää seurannan.
- [ ] Kynäkohtaiset draw/travel/wait/total-ajat näkyvät ja summa vastaavaa kokonaisaikaa.
- [ ] Jokaiselle playbackissa käytetylle kynälle voi antaa viivanpaksuuden millimetreinä.
- [ ] Kynän viivanpaksuus näkyy sekä valmiissa että jäljellä olevassa playback-radassa ja säilyy sivun uudelleenlatauksessa.
- [ ] Playbackin `Paper color` vaihtaa esikatselun taustavärin ja säilyy sivun uudelleenlatauksessa.
- [ ] Toisto päättyy kokonaisaikaan eikä jatku sen yli.

## Värit ja käyttöliittymä

- [ ] Työkalupalkki näkyy kahtena erillisenä rivinä ja kumpaakin riviä voi vierittää vaakasuunnassa pienessä ikkunassa.
- [ ] `Pen colors` näyttää jokaisen käytetyn kynän ja valmiin väripaletin.
- [ ] Palettivärin tai vapaan värivalitsimen valinta päivittää canvasin, outlinen ja playbackin.
- [ ] Kynäväri säilyy tallennetussa G-codessa `LATU PEN COLOR` -metatietona ja palautuu uudelleen avattaessa.

## G-code-tekstin muokkaus ja haku

- [ ] G-code-rivejä ja numeerisia arvoja voi muokata suoraan Text-näkymässä; canvas päivittyy viiveen jälkeen.
- [ ] `Find / Replace` avaa hakurivin myös Canvas-only-tilasta.
- [ ] Find löytää seuraavan osuman Enterillä/alasnuolella ja edellisen Shift+Enterillä/ylänuolella.
- [ ] Replace korvaa valitun osuman ja All korvaa kaikki osumat, esimerkiksi `PAUSE` → `M0`.
- [ ] `Aa` tekee hausta kirjainkoon huomioivan.
- [ ] Find/Replace-muutokset kuuluvat Undo/Redo-historiaan.

## Pitkä tiedosto ja selainkäytös

- [ ] 51 vedon fixture zoomaa, mittaa, valitsee ja toistaa ilman näkyvää nykimistä.
- [ ] Selainikkunan tai Canvas/Text-jakajan koon muuttaminen muuttaa canvas-elementin kokoa ilman vääristymää ja säilyttää zoomin.
- [ ] Canvas/Text/Split-vaihdot eivät hävitä valintaa tai muokkauksia.
- [ ] Sivun reload palauttaa profiilit ja snippetit mutta ei keskeneräistä tiedostoa.
- [ ] Sivulla ei ole testin jälkeen console error -viestejä.

## Hyväksymisehto

- [ ] Kaikki yllä olevat kohdat on testattu.
- [ ] Yhtään estävää tai vakavaa avointa virhettä ei ole.
- [ ] Tallennettu servo-Z-tiedosto on tarkastettu tekstinä ennen koneelle lähettämistä.
- [ ] Tallennettu bed-Z-tiedosto on tarkastettu tekstinä ennen koneelle lähettämistä.

## Havaitut virheet

| Tila | Vakavuus | Ominaisuus | Toistovaiheet | Odotettu | Toteutunut |
|---|---|---|---|---|---|
| Avoin |  |  |  |  |  |
