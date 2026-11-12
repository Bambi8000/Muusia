# Print: Raspberry Pi -tulostussivu

Tila 9.11.2026: Raspberry Pi 3:n **Print**-sivu tulostaa Epson TM-T88V:lle USB:n kautta. Sivulla voi esikatsella kuitteja, kuvia, tekstiä ja testikorttia sekä lisätä niitä tulostusjonoon. Print-nimi näkyy Pi:n sivulla ja sen palvelukuvauksessa; sivu tarkistettiin Macin Chromessa, ja palvelu ilmoitti USB-tulostimen valmiiksi. Kolme talteen otettua työtä — teksti, Epson-testikortti ja Muusia-kuitti — tulostettiin oikealle paperille. Käyttäjä vahvisti, että kuvat ja leikkaukset tulivat siististi. Erillinen täyden leikkauksen komento testattiin: laite jätti edelleen yhden reunakielekkeen, kuten TM-T88V:n osittaisleikkaukselta odotetaan. Pi ilmoittaa ajoittaista alijännitettä; käyttäjä pyysi jatkamaan tulostusta siitä huolimatta.

`DOWNLOAD RECEIPT FILE` tallentaa saman bittikuvan `*.muusia-receipt.json`-tiedostoksi ilman tulostinta. Tiedosto sisältää `format`, `version`, `width`, `height`, Base64-muotoisen 1-bittisen `data`-kentän ja `cut`-valinnan. Thermal Text lisää tiedostoon `thermalText`-kentän, jonka Print-palvelu tulostaa Epsonin omilla fonteilla kuvan eteen tai perään. Latu näyttää tiedoston kohdasta **Document → Open receipt preview…**, mutta sen esikatselu näyttää nykyisin vain rasterikuvan, ei Epsonin omilla fonteilla tulostettavia tekstilohkoja. Latu voi myös avata tämän palvelimen tuottaman `.escpos`-tavuvirran esikatseluun; kumpaakaan muotoa ei tulkita G-codeksi tai muokattaviksi viivoiksi.

## Kellotila Print-sivulla

**Clock**-välilehdellä valitaan **Every second** (`HH:MM:SS`) tai **Every minute**
(`HH:MM`) ja painetaan **Start clock**. Aika tulee Raspberry Pi:n paikallisesta
kellosta. Jokainen rivi käyttää Epsonin omaa Font A -fonttia, on keskitetty,
lihavoitu ja kooltaan 2×2. **Stop clock** lopettaa ajastuksen; parhaillaan
tulostuva rivi voi valmistua. Kellotila ei koskaan lähetä leikkauskomentoa.
Ajastus jatkuu Pi:llä myös selaimen sulkemisen jälkeen, mutta palvelun
uudelleenkäynnistys pysäyttää sen. Jos tulostin on varattu, kyseinen ajanhetki
ohitetaan eikä rivejä kerätä jonoon. Pi:n `/api/clock` näyttää tilan ja
`/api/clock/stop` pysäyttää sen myös ilman selainta.

## Kuittikangas Muusiassa

Valitse yläpalkin **Size preset → Receipt · 72 × 100 mm** lyhyelle kuitille tai **Receipt strip · 72 × 250 mm** pidemmälle nauhalle. Voit myös asettaa Canvas-leveydeksi **72 mm** ja korkeudeksi haluamasi kuittipituuden. 80 mm:n rullassa tulostettava alue on noin 72 mm; Muusia skaalaa koko kankaan leveyden 512 pisteeseen. Valitse tulostettava solmu, pidä **Mega Canvas** pois päältä ja käytä **DOWNLOAD RECEIPT FILE** -painiketta Latu-esikatseluun. Tämä ei tarvitse Epsonia, Raspberry Pi:tä eikä tokenia.

Animaatiolle aseta **ANIMATE → Frames**, valitse tulostettava solmu ja paina **Receipt × N**. Muusia laskee jokaisen freimin erikseen ja lataa ne yhtenä ZIP-pakettina (`*.muusia-receipt.json` per freimi; yhdestä freimistä tulee yksittäinen tiedosto). Uudessa formaatissa jokaisen 416 pisteen levyisen kuva-alueen kulmissa on 32 pisteen ulospäin osoittavat L-merkit, yläpuolella suuri `F001/012`-numero ja sen alla koneellisesti luettava 16-solun numeroraita. Liike kohdistaa kuvat L-merkkeihin ja lukee freiminumerot automaattisesti. Vanhat pienimerkkiset kuitit pysyvät käytettävissä Liikkeen aiemmalla tunnistuksella tai käsin kohdistamalla. ZIP:n yksittäiset tiedostot avautuvat Latussa kuten tavallinen kuitti. Muusia ei lähetä koko animaatiota tulostusjonoon automaattisesti.

Latussa voit avata myös koko animaation ZIP-paketin kohdasta **Document → Open receipt preview…**. Esikatselussa on Play/Pause, edellinen/seuraava freimi ja aikajana. Toisto kiertää viimeisestä freimistä takaisin ensimmäiseen.

Ensimmäistä Epsonin laitetestiä varten avaa valmis esimerkki **Help → Test Card · Thermal receipt** ja valitse sen **Test Card** -node. Vaihtoehtoisesti valitse **Size preset → Receipt · 72 × 100 mm**, lisää **Test Card** -node ja aseta **Card → Thermal receipt**. Tallenna valittu node painamalla **DOWNLOAD RECEIPT FILE**. Avaa tiedosto Latussa ennen tulostamista. Kuvio sisältää 1–4 pisteen pysty- ja ristikkotiheyksiä, tiukkoja kaaria, pieniä kirjaimia ja pisteitä, mustavalkoisella rasterilla tehtyjä 0/25/50/75/100 % harmaasävyruutuja sekä vuorottelevia tummia palkkeja. Kuittipalvelu ei saa erillisiä harmaatasoja: sävyt muodostuvat mustien pisteiden tiheydestä. Kun tulostin on käytössä, sama valittu node voidaan lähettää **PRINT RECEIPT** -painikkeella.

## Surface Composer: yksi pitkä suikale kerrallaan

Paikallinen Muusia 2.179 tarjoaa **Surface Composer → Print / continue** -paneelin. Valitse suikale ja tarvittaessa aloitus-/lopetuskohta millimetreinä. Oletus lähettää **vain yhden suikaleen tai osavälin**. Seuraavan suikaleen valinta valmistumisen jälkeen ei tulosta sitä: odota jäähtymistä ja käynnistä jatko käsin. Lyhyille töille voi erikseen rastittaa jäljellä olevien suikaleiden peräkkäistulostuksen. Rastitusta ei palauteta projektista. **Stop after current** lopettaa jatkon nykyisen työn jälkeen.

**Total paper** näyttää näkyvien suikaleiden metrit lisävaroineen ja vertaa niitä annettuun rullaan. Rullan pituus, jo käytetty osuus, varaus ja syöttö-/leikkausvara annetaan käsin. Ne ovat kulutusarvio, eivät anturitietoa. Tallennettava jatkokohta on suikaleen alkuperäisessä kuvakohdistuksessa; osaväli ei skaalaa sisältöä uudelleen.

Uusi `GET /api/strip-capabilities` ilmoittaa tuen, ja `POST /api/strip-jobs` ottaa yhden 512 × enintään 65 535 rivin rasterin (6 MB pyyntöraja). Koko suikale kulkee yhtenä työnä nykyisen USB-työntekijän läpi: 256 rivin ESC/POS-lohkot, alustus kerran ja valittu leikkaus vain lopussa. Tavallinen `/api/jobs` ja Print-sivun tavalliset kuvat säilyttävät 4096 rivin rajansa. Suikalereitti edellyttää tyhjää aktiivijonoa ja pysäytettyä Clock-tilaa. Työn `requestId` estää saman tunnisteen jonottamisen uudelleen palvelimen nykyisessä historiassa. Historiakuvien muistiraja on 32 MiB; vanha valmis esikatselu voi poistua.

Mittakaava perustuu käyttäjän paperilta mittaamaan 400 pisteen = 56,6 mm X/Y-väliin. Turvalliset sarakkeet 1…499 perustuvat fyysisesti vahvistettuihin 4,6 mm sivureunoihin; paperin tarkka leveys on edelleen arvio. Noin 9,27 m työraja on palvelun nykyinen rasteriraja. Tulostin ei ilmoita sovellukselle paperin jäljellä olevia metrejä tai jäähtymistä.

Palvelin päivitettiin Pi:lle 13.11.2026 aktiivijonon ollessa tyhjä ja Clock pysäytettynä. USB-valmius ja uusi rajapinta tarkistettiin. Varmuuskopio: `/home/print/muusia-print/server.py.before-surface-20261113-001303`. Tulostimen asetuksia ei muutettu. Uusi 2 m työ, osaväli ja erikseen valittu kahden lyhyen työn jatko tarkistettiin selaimessa **kuivatestitiedostoon**, eivät fyysiselle paperille. Palvelimen 9 testiä kattavat myös tavutarkan 2 m ESC/POS-virran, lopullisen leikkauksen, varatun jonon hylkäyksen ja toistetun tunnisteen.

## Paperi ja tulostin

- Epsonin mukaan 80 mm:n paperin todellinen leveys on 79,5 ± 0,5 mm, rullan suurin halkaisija 83 mm ja hylsyn sisähalkaisija 12 mm. Tulostettava alue on 512 pistettä eli noin 72 mm. Tarkista rullan hylsy ja lämpöherkkä puoli ennen hankintaa. [TM-T88V Technical Reference Guide](https://download4.epson.biz/sec_pubs/bs/pdf/TM-T88V_trg_en_revG.pdf)
- Ohjelma käyttää ESC/POSin `GS v 0` -kuvakomentoa. Tavallisen kuitin leikkaus käyttää `GS V 65 32` -komentoa: tulostin syöttää paperin leikkuriin, lisää 32 pisteen marginaalin ja leikkaa. Alkuperäinen kiinteä 112 pisteen syöttö leikkasi ensimmäisen laitetestin kuvion keskeltä. Erillinen **Cut paper** lähettää vain `GS V 0` -komennon eikä syötä paperia. TM-T88V jättää leikatun kuitin reunaan pienen kiinnikkeen; tämä on mallin normaali osittaisleikkaus. [Epsonin leikkauskomennot](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_cv.html), [TM-T88V Technical Reference Guide](https://download4.epson.biz/sec_pubs/bs/pdf/TM-T88V_trg_en_revG.pdf)
- Lähtökohtana on 80 mm:n paperiasetus. Jos käytetty tulostin on vaihdettu 58 mm:n asetukseen, 512 pisteen kuva ei mahdu; varmista asetukset itsetestitulosteesta.

## Raspberry Pi -asennus

Pi:lle riittää Python 3:n vakiokirjasto. Tiedostot asennetaan `print`-käyttäjän kotihakemiston `muusia-print`-kansioon. Lisää käyttäjä ensin `lp`-ryhmään komennolla `sudo usermod -aG lp print` ja avaa uusi SSH-istunto. `setup-pi.sh` laittaa uuden asennuksen kirjoittamaan kuivatestissä `test-output.escpos`-tiedostoon. Palvelu kuuntelee vain Pi:n omassa `127.0.0.1:8631`-osoitteessa; sitä ei voi avata suoraan lähiverkosta. Käyttäjäpalvelu käynnistää Pythonin `lp`-ryhmässä ilman koko käyttäjäistunnon katkaisua. Sivun nimi on **Print**; asennushakemisto, palveluyksikön tunnus ja Muusian kuittitiedoston muoto säilyvät yhteensopivuuden vuoksi ennallaan.

```sh
cd ~/muusia-print
sh setup-pi.sh
loginctl enable-linger print
```

Viimeinen komento pitää käyttäjäpalvelun käynnissä uloskirjautumisen jälkeen ja käynnistää sen Pi:n käynnistyessä. Sen jälkeen Macilla avataan tunneli:

```sh
ssh -N -L 8633:127.0.0.1:8631 print@print.local
```

Avaa selaimessa `http://127.0.0.1:8633/`. Tämän Macin portti 8631 on varattu toiselle ohjelmalle, joten tunnelin paikallinen portti on 8633. Muusian **PRINT RECEIPT** käyttää samaa osoitetta oletuksena. Tunnusta ei enää tarvita kummassakaan käyttöliittymässä. SSH-tunneli ja Pi:n vain paikallinen kuuntelu rajaavat yhteyden tähän Maciin; palvelua ei ole avattu lähiverkkoon tai internetiin.

## Tulostussivu

- **Receipt file** avaa yksittäisen Muusian `.muusia-receipt.json`-tiedoston tai animaation ZIP-paketin. Kaikkia freimejä voi selata ja jonottaa yksittäin tai järjestyksessä.
- **Image** avaa PNG-, JPEG- tai WebP-kuvan, sovittaa sen 512 pisteen leveyteen ja muuntaa sen mustavalkoiseksi pistekuvaksi. Valittavana on kynnys tai dithering.
- **Text** tekee yksinkertaisen tekstikuitin selaimessa.
- **Test card** luo tiheät viivat, ruudukot, kaaret, harmaasävyruudut ja tummat palkit Epsonin ensimmäistä laitetestiä varten.
- **Print queue** näyttää odottavat, käynnissä olevat ja valmistuneet työt. Odottavan työn voi perua, ja aiemman työn esikatsella tai lisätä jonoon uudelleen.
- **Cut paper** lisää jonoon vain `GS V 0` -leikkauskomennon. Se leikkaa nykyisestä kohdasta eikä syötä kuvaa pidemmälle paperista ulos. Täyden leikkauksen pyyntö jätti todellisessa testissä TM-T88V:n normaalin reunakielekkeen; sitä ei voi poistaa tällä komennolla.

## Printer Lab: Epsonin omat fontit

### Thermal Text -node kuitissa

Lisää **Thermal Text** kuvan jälkeen ja valitse sen sininen ulostulo tulostettavaksi. *Place → Before/After* määrää, tuleeko Epsonin oma teksti ennen kuvaa vai sen jälkeen. Vaihtoehdot ovat vasen/keski/oikea tasaus, Font A/B, leveys ja korkeus 1–8×, lihavointi, alleviivaus, käänteinen tulostus, kaikki 42 valmista merkistösivua ja 18 kansainvälistä asetusta. `|` tekstikentässä tekee rivinvaihdon; heksatavut antavat käyttöön myös sivut, joille Unicode-muunnosta ei ole. Ilman kuvayhteyttä node tuottaa pelkän tekstikuitin. Useita nodeja voi ketjuttaa enintään kahdeksaksi tekstilohkoksi. Teksti ja kuva lähetetään samassa työssä, ja mahdollinen leikkaus tulee vasta viimeisen lohkon jälkeen.

Esimerkki: **Test Card** (*Card → Thermal receipt*) → **Thermal Text** (*Text: MUUSIA*, *Place: Before*, *Align: Center*, *Width/Height: 2*, *Bold: on*) → valitse Thermal Text → **PRINT RECEIPT**. Muusian kangas ja SVG/G-code sisältävät edelleen vain viivakuvan; Epson tekee tekstin vasta tulostushetkellä. Kuittitiedoston `thermalText` säilyy Print-sivun tuonnissa, uusintatulostuksessa ja työhistorian latauksessa. Fontin tarkka ulkoasu on varmistettava paperilta.

Pi:n tulostussivun **Printer Lab** ja Muusian tulostuspaneelin **PRINTER LAB · NATIVE FONTS** käyttävät Epsonin sisäisiä Font A- ja Font B -bittikarttafontteja. Testit muodostetaan palvelimella rajatuista ESC/POS-komennoista; esikatselu on arvio, koska oikeat merkit piirretään tulostimen muistissa. Jokaisen kokeen voi jonottaa tai ladata täsmälleen samana `.bin`-komentovirtana.

- **Font A / B** tulostaa kirjaimet, numerot ja ASCII-välimerkit kummallakin fontilla.
- **Font scaling matrix** näyttää kummankin fontin kaikki 1–8× leveys- ja korkeusyhdistelmät. Jokaisella H1–H8-rivillä kahdeksan `M`-merkkiä ovat vasemmalta oikealle W1–W8; suurelle korkeudelle asetetaan vastaava riviväli.
- **Typography matrix** näyttää normaalin, lihavoidun, alleviivatun ja käänteisen tekstin, 2× leveyden/korkeuden sekä vasemman, keskitetyn ja oikean tasauksen.
- **Character pages** näyttää 2× kokoisina suomalaiset `ÄäÖöÅå`-merkit ja tavut `80–FF` PC437-, PC850-, PC865- ja PC858-sivuilla; PC858-rivillä on myös euro-merkki. Lisäksi alussa on Ruotsin kansainvälisen merkistön (`ESC R 5`) ASCII-merkeillä tehty ÄÖÅäöå-koe.

Neljä koetta lähetettiin Pi:n USB-jonon kautta 9.11.2026. Palvelu merkitsi kaikki neljä valmiiksi. Käyttäjän mukaan kolme ensimmäistä näytti hyvältä, mutta alkuperäisen Character pages -testin ääkköset puuttuivat ja merkit olivat liian pieniä. Merkistötesti suurennettiin ja lisättiin Ruotsin merkistökokeilu. Korjattu kuitti tulostui ja käyttäjä vahvisti sen toimivaksi. Jokainen koe päättyy samaan `GS V 65 32` -leikkaukseen kuin normaalit kuitit. [TM-T88V:n tukemat komennot](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/tmt88v.html), [fonttikoko 1–8×](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_exclamation.html), [merkistösivut](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/esc_lt.html), [kansainvälinen merkistö](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/esc_cr.html).

### Kaikki valmiit merkit Muusiassa

Epson listaa tälle TM-T88V:lle 43 merkistösivua, joista 42 sisältää valmiit merkit ja sivu 255 on käyttäjän määrittelemä. Lisäksi käytettävissä on 18 kansainvälistä asetusta (`ESC R 0–17`). **Native glyph explorer** näyttää kaikki 42 valmista sivua ja jokaisen tavupaikat `20–FF`. Valittu merkki lisätään tulostettavaan tavujonoon täsmällisellä heksakoodilla, joten myös sellaiset sivut ovat käytettävissä, joille selaimen tai Pythonin Unicode-muunnosta ei ole. Tuetuilla muunnoksilla voi kirjoittaa tekstiä suoraan: esimerkiksi kyrillinen PC866 (sivu 17), islantilainen PC861 (35) ja kyrillinen Windows 1251 (46). Fontti A/B, leveys ja korkeus 1–8×, lihavointi, alleviivaus, käänteinen tulostus ja leikkaus ovat valittavissa. Esikatselu, `.bin`-vienti ja tulostus käyttävät samaa rajattua ohjelmageneraattoria.

Ruudukon merkit ovat tietokoneen merkkikartan arvio; Epsonin sisäisen fontin todellinen ulkoasu näkyy paperilla. Asian kielten monimerkkiset fontit riippuvat laitteen kielimallista, eikä niitä oleteta käytettävissä oleviksi tässä M244A-yksilössä. Tyhjä käyttäjän määrittelemä sivu 255 ei sisällä valmiita merkkejä. Epsonin tekninen opas määrittää mallille myös **180 × 180 dpi** -tarkkuuden; varhaisen projektihandoutin 203 dpi oli arvio. [Epsonin TM-T88V-merkistösivut](https://download4.epson.biz/sec_pubs/pos/reference_en/charcode/supported_codepage.html), [kansainväliset asetukset](https://download4.epson.biz/sec_pubs/pos/reference_en/charcode/supported_international.html), [TM-T88V Technical Reference Guide](https://download4.epson.biz/sec_pubs/bs/pdf/TM-T88V_trg_en_revG.pdf).

Pi:n kautta tulostettiin lisäksi 2× kokoiset PC866-kyrillinen ja PC861-islantilainen esimerkkikuitti. Käyttäjä vahvisti molempien merkkien näkyvän oikein paperilla. Muut merkistösivut ovat valittavissa, mutta niiden yksittäisten merkkien paperiasua ei ole vielä tarkistettu.

Jono ja työhistoria ovat Pi:n muistissa: palvelun uudelleenkäynnistys tyhjentää ne. Tavallisen kuittireitin yksittäinen kuva saa olla enintään 512 × 4096 pistettä; Surface Composerin erillinen suikalereitti kuvataan yllä. Jonoon mahtuu 64 odottavaa työtä ja historiaan 100 työtä. `done` tarkoittaa, että ESC/POS-tavut on kirjoitettu tiedostoon tai USB-laitteelle; se ei todista paperitulosteen laatua. Kuivatestitiedostoon kertyy kaikkien töiden tavut peräkkäin.

## USB-tulostus

Tällä Pi:llä Epson näkyy USB-tunnisteella `04b8:0202`, tuotteen nimi on `TM-T88V` ja laitepolku on `/dev/usb/lp0`. Palvelun ympäristötiedostossa `~/.config/muusia-print.env` on `MUUSIA_PRINT_DEVICE=/dev/usb/lp0`, eikä kuivatestin `MUUSIA_PRINT_OUTPUT_FILE` ole enää käytössä. Jos tulostin irrotetaan tai laitepolku vaihtuu, tarkista `lsusb`, `ls -l /dev/usb/lp*`, `systemctl --user status muusia-print.service` ja `journalctl --user -u muusia-print.service -n 50`. Uudella Pi-asennuksella vaihda ympäristötiedoston kuivatestirivi USB-laitepolkuun vasta, kun laite tunnistuu.

Muusiassa valitse pieni viivapiirros ja jätä Mega Canvas pois. Tulostus skaalautuu 72 mm:n tulostusleveyteen. Tämän tavallisen kuittipolun enimmäispituus on noin 58 cm; aloita paljon lyhyemmällä kuvalla. Käytä tämän Macin palvelinosoitetta `http://127.0.0.1:8633`. Tulostussivun työt kulkevat saman palvelun kautta. Yhteys tarvitsee käynnissä olevan SSH-tunnelin, mutta ei tulostustunnusta.

## Rajat ja seuraava vaihe

Muusian oma tulostuspolku käsittelee viivat mustina riippumatta kynäväristä. Dashboardin kuvat muunnetaan mustavalkoisiksi selaimessa. Palvelun `done` kertoo, että tavut menivät USB-laitteelle; Epsonin oma tila ja paperin loppuminen eivät vielä palaudu sivulle. Pi on raportoinut arvon `throttled=0x50005` eli ajoittaista alijännitettä ja hidastumista. [Raspberry Pi:n virtalähdesuositus Pi 3:lle](https://www.raspberrypi.com/documentation/computers/getting-started.html)
