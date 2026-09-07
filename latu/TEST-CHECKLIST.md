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
- [ ] Tiedoston voi pudottaa ikkunaan drag-and-dropilla.
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
- [ ] `Y axis ↑` kääntää näkymän muuttamatta G-codea.
- [ ] Hiiren rulla zoomaa osoittimen kohdalta.
- [ ] `−` pienentää zoomia näkymän keskeltä.
- [ ] `＋` suurentaa zoomia näkymän keskeltä.
- [ ] `Fit` sovittaa koko piirroksen näkyviin.
- [ ] Zoomilukema päivittyy ja pysyy välillä 0,1–64 px/mm.
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
- [ ] Nuolinäppäin siirtää valintaa 0,1 mm; Shift 1 mm.
- [ ] Numeerinen Move siirtää valintaa annetun X/Y-määrän.
- [ ] Delete poistaa valitun pisteen, vedon tai tapahtuman turvallisena kokonaisuutena.
- [ ] Copy/Paste monistaa valitut kokonaiset vedot.
- [ ] Reverse vaihtaa vedon suunnan muuttamatta geometriaa.
- [ ] `+ Point` lisää keskipisteen oikeaan segmenttiin.
- [ ] Segmentin kaksoisklikkaus lisää pisteen täsmälliseen kohtaan.
- [ ] Split jakaa vedon ja lisää tarvittavan nosto/travel/lasku-rakenteen.
- [ ] Join yhdistää kaksi vierekkäistä vetoa lähimmistä päistä.
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
- [ ] Toisto päättyy kokonaisaikaan eikä jatku sen yli.

## Pitkä tiedosto ja selainkäytös

- [ ] 51 vedon fixture zoomaa, mittaa, valitsee ja toistaa ilman näkyvää nykimistä.
- [ ] Selainikkunan koon muuttaminen sovittaa canvasin ilman vääristymää.
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
