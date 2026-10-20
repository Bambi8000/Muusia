# Neulapistot: paperi + noin 4 mm pahvi

Muusia 2.133:n **D — Needle Z (max 2 mm)** -profiili tekee pistot Z-akselilla.
Servon nostomekanismi poistetaan välistä ja neula kiinnitetään jäykästi Z:n
mukana liikkuvaan pitimeen. Irrota servon johdot virrat katkaistuina.

Paperin yläpinta on työkoordinaatiston **Z0**. Pahvi on sen alapuolella.
Pistosyvyyttä mitataan paperin yläpinnasta, ei pahvin alapinnasta:

- Aloituskoe: Depth **0,5 mm** → Z−0,5.
- Enimmäissyvyys: Depth **2 mm** → Z−2.
- Jokaisen piston jälkeen neula nousee **Z+3 mm** ennen XY-siirtoa.
- Noin 4 mm:n alusta jättää nimellisesti noin 2 mm varaa kovaan pöytään.
  Varmista todellinen paksuus, tasaisuus ja ettei pahvi painu liikaa.

Kiinnitä paperi ja pahvi niin, ettei neula nosta niitä mukaansa.

## Muusia

1. Avaa Machine Setup ja valitse **D — Needle Z (max 2 mm)**.
   Vanhaan projektiin profiilin saa painikkeella **Add Needle Z profile · max 2 mm**
   tai tuomalla viereisen `needle-2mm.muusia-machine.json`-tiedoston.
2. Tarkista oman koneen työalue, XY-origo ja Flip Y. Profiilin työaluetta ei
   ole mitattu uudelleen; säilytä koneellesi kalibroidut arvot.
3. Kytke **piirros → Needle Punch → ulostulo**. Laita Needle Punch viimeiseksi.
   Käytä yhtä Pen-arvoa. Interval on reikien väli; Depth on syvyys paperin alle.
4. Aloita muutamasta pistosta, Depth 0,5 mm. Lisää tarvittaessa, enintään 2 mm.
5. Vie **G-code**. SVG ja DXF eivät sisällä pistosyvyyttä.
6. Tallenna projekti tai profiili, jos haluat säilyttää valinnan.

Neulaprofiilin vienti hylkää koko työn ilman suoritettavia komentoja, jos
syvyys ylittää 2 mm, syvyystieto puuttuu tai mukana on sivusuunnassa piirrettävä
viiva, useita kyniä, Travel Stop, servo-ohjaus, kierto, kastelu tai huoltorutiini.
Myös neulaprofiilin alku-/loppukomentojen muuttaminen estää viennin. Tavallisten
kynäprofiilien aiempi syvyyskäyttäytyminen säilyy, joten valitse juuri neulaprofiili.

## Syvyyden ja pistevälin testikuvio

Valitse **Help → Needle Test · Depth and spacing** tai lisää **Needle Test**
Generaattoreista. Node tuottaa pistot itse: kytke se suoraan ulostuloon.

Jokaisella vaakarivillä on yksi vakiosyvyys ja yksi vakioetäisyys pistojen
välillä. Kaikki syvyyden ja pistevälin yhdistelmät saavat oman rivinsä.

- **Max depth (mm)** määrää syvimmän piston (oletus 0,5 mm, yläraja 2 mm).
- **Depth steps** jakaa syvyydet tasaisesti: viidellä tasolla ja 2 mm:n
  maksimilla syvyydet ovat 0,4 / 0,8 / 1,2 / 1,6 / 2 mm.
- **Min spacing / Max spacing** ja **Spacing steps** määräävät pistevälit.
  Oletussarja on 0,5 / 1,125 / 1,75 / 2,375 / 3 mm.
- **Punches per row** on pistomäärä kullakin rivillä, vähintään 20.
  Oletuksena viisi syvyyttä × viisi pisteväliä = 25 riviä ja 500 pistoa.
- **Row gap (mm)** määrää rivien välisen etäisyyden.

Ensin tehdään yhden syvyyden kaikki pistevälit omille riveilleen ja sitten
siirrytään seuraavaan syvyyteen. Esikatselun D on rivin syvyys ja S pisteväli;
merkintöjä ei ajeta neulalla. Merkitse rivit paperiin tarvittaessa käsin.
Jos koko kuvio ei mahdu, node ei tuota pistoja. Suurenna arkkia tai vähennä
syvyys- ja pistevälitasoja, pistemäärää tai pisteväliä. Pistevälejä ei skaalata.
Valitse **Needle Z** -koneprofiili ja vie G-code. Kalibroi paperin pinta ennen ajoa.

## Klipperin käyttöönotto

Neulamuutokset on siirretty viivaimen `printer.cfg`-tiedostoon 17.10.2026.
Alkuperäinen tiedosto on varmuuskopioitu koneelle nimellä
`printer.cfg.before-needle-20261017T172119Z.bak`. Makrot on tarkistettu koneen
omalla Jinja2 2.11.3 -ympäristöllä ja asennetun Mainsailin makroja vasten.
Klipper on käynnistetty onnistuneesti uudelleen ja ilmoittaa olevansa valmis.
Neulatila on pois päältä ja pinta kalibroimatta. Akseleille ei ole annettu
liikekomentoja eikä koepistoja tehty; neulapidintä ei ole vielä rakennettu.
Ota sen neulamuutokset
käyttöön koneen nykyiseen konfiguraatioon verraten, säilyttäen koneen omat
kalibroinnit. Muutos käyttää nykyisen mainsail.cfg:n PAUSE- ja park-makroja.
Älä lisää samoja makroja kahteen eri tiedostoon. Tarkista konfiguraation latautuminen
ennen neulan kiinnittämistä.

Jokaisen käynnistyksen, kotiajon sekä neulan tai materiaalin vaihdon jälkeen:

1. `NEEDLE_MODE_ON` valitsee neulatilan ja mitätöi aiemman pintakalibroinnin.
2. Kotiaja XYZ. Tällä koneella Z kotiajetaan ensin ylöspäin.
3. Aseta pahvi ja paperi paikalleen. Siirrä neula testikohtaan kärki irti materiaalista.
4. Laske Z hitaasti, kunnes kärki juuri koskettaa paperin yläpintaa.
5. Suorita `NEEDLE_ZERO_HERE`. Tämä määrittää työ-Z0:n ilman koneen
   fyysisten liikerajojen siirtämistä. Kalibrointi hylätään, ellei koneella ole
   tilaa sekä 2 mm alaspäin että 3 mm ylöspäin.
6. Suorita `NEEDLE_LIFT` **ennen seuraavaa XY-siirtoa**. Aseta XY-origo
   tarvittaessa `PAPER_ZERO`-makrolla kärki nostettuna; varmista Muusian Origin X/Y.
7. Aja pieni koetiedosto. Tiedoston `NEEDLE_BEGIN` tarkistaa kalibroinnin ja
   nostaa neulan; se ei kotiaja eikä käy kynän asetuspalikalla.

Neulatilassa PEN_UP nostaa Z:llä ja PEN_DOWN, PLOT_START, PLOT_HEIGHT sekä
vanha Z_ZERO_HERE on estetty. M0 nostaa ja tauottaa paikallaan. Mainsailin PAUSE
nostaa ennen paluuasennon tallentamista; tauon ja peruutuksen automaattinen
XY-parkki ohitetaan. Jatkaminen käyttää nostoa ilman palikkakäyntiä.
Jos neulaa tai alustaa muutetaan tauolla, keskeytä työ ja kalibroi uudelleen.

Neulatila valitaan uudelleen jokaisen Klipper-käynnistyksen jälkeen.
`NEEDLE_MODE_OFF` palauttaa servotyönkulun; käytä sitä vasta kun servotyökalu
on asennettu takaisin ja tee normaali kynän kalibrointi.

**2 mm:n raja on Muusian neulaviennin raja.** Se ei rajoita käsin annettuja
Z-komentoja, muuta G-codea tai vanhempien Muusia-versioiden vientiä.
Älä avaa neulaprofiilia alle 2.133-versiolla. Oikea pintakalibrointi tarvitaan,
jotta työkoordinaatiston 2 mm vastaa todellista tunkeumaa.

Makrojen koordinaattisiirrot ja tilan tallennus seuraavat
[Klipperin G-code-ohjetta](https://www.klipper3d.org/G-Codes.html#set_gcode_offset).
Tauko-/peruutusmuutos huomioi
[Mainsailin makrojen suoritusjärjestyksen](https://github.com/mainsail-crew/mainsail-config/blob/master/client.cfg).

## Paikalliset tarkistukset

- `node tools/validate-needle-export.mjs`: todellinen G-code-vientifunktio,
  syvyysrajat, nostot, virheelliset projektit, node-geometria ja profiilin tallennus.
- `python3 tools/validate-needle-klipper.py` (vaatii Jinja2): konfiguraation ja
  makrojen mallineet, kalibroinnin tarkistukset ja servo-/neulahaarat ilman konetta.
- Nämä tarkistukset eivät korvaa oikealla koneella tehtävää käyttöönottoa.
