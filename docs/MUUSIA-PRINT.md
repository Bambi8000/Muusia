# Muusia Print: Raspberry Pi -tulostussivu

Tila 9.11.2026: Raspberry Pi 3:n Muusia Print -sivu tulostaa Epson TM-T88V:lle USB:n kautta. Sivulla voi esikatsella kuitteja, kuvia, tekstiä ja testikorttia sekä lisätä niitä tulostusjonoon. Kolme talteen otettua työtä — teksti, Epson-testikortti ja Muusia-kuitti — tulostettiin oikealle paperille. Käyttäjä vahvisti, että kuvat ja leikkaukset tulivat siististi. Erillinen täyden leikkauksen komento testattiin: laite jätti edelleen yhden reunakielekkeen, kuten TM-T88V:n osittaisleikkaukselta odotetaan. Pi ilmoittaa ajoittaista alijännitettä; käyttäjä pyysi jatkamaan tulostusta siitä huolimatta.

`DOWNLOAD RECEIPT FILE` tallentaa saman bittikuvan `*.muusia-receipt.json`-tiedostoksi ilman tulostinta. Tiedosto sisältää `format`, `version`, `width`, `height`, Base64-muotoisen 1-bittisen `data`-kentän ja `cut`-valinnan. Latu näyttää tiedoston kohdasta **Document → Open receipt preview…**. Latu voi myös avata tämän palvelimen tuottaman `.escpos`-tavuvirran esikatseluun; kumpaakaan muotoa ei tulkita G-codeksi tai muokattaviksi viivoiksi.

## Kuittikangas Muusiassa

Valitse yläpalkin **Size preset → Receipt · 72 × 100 mm** lyhyelle kuitille tai **Receipt strip · 72 × 250 mm** pidemmälle nauhalle. Voit myös asettaa Canvas-leveydeksi **72 mm** ja korkeudeksi haluamasi kuittipituuden. 80 mm:n rullassa tulostettava alue on noin 72 mm; Muusia skaalaa koko kankaan leveyden 512 pisteeseen. Valitse tulostettava solmu, pidä **Mega Canvas** pois päältä ja käytä **DOWNLOAD RECEIPT FILE** -painiketta Latu-esikatseluun. Tämä ei tarvitse Epsonia, Raspberry Pi:tä eikä tokenia.

Animaatiolle aseta **ANIMATE → Frames**, valitse tulostettava solmu ja paina **Receipt × N**. Muusia laskee jokaisen freimin erikseen ja lataa ne yhtenä ZIP-pakettina (`*.muusia-receipt.json` per freimi; yhdestä freimistä tulee yksittäinen tiedosto). Jokaisen kuvan yläreunaan rasteroidaan pieni `F01/12`-tyyppinen numero ja kuvan alkuun ja loppuun lyhyet leikkausmerkit. Merkit lisäävät kuittiin 30 pisteriviä eli noin 4 mm. ZIP:n yksittäiset tiedostot avautuvat Latussa kuten tavallinen kuitti. Muusia ei lähetä koko animaatiota tulostusjonoon automaattisesti.

Latussa voit avata myös koko animaation ZIP-paketin kohdasta **Document → Open receipt preview…**. Esikatselussa on Play/Pause, edellinen/seuraava freimi ja aikajana. Toisto kiertää viimeisestä freimistä takaisin ensimmäiseen.

Ensimmäistä Epsonin laitetestiä varten avaa valmis esimerkki **Help → Test Card · Thermal receipt** ja valitse sen **Test Card** -node. Vaihtoehtoisesti valitse **Size preset → Receipt · 72 × 100 mm**, lisää **Test Card** -node ja aseta **Card → Thermal receipt**. Tallenna valittu node painamalla **DOWNLOAD RECEIPT FILE**. Avaa tiedosto Latussa ennen tulostamista. Kuvio sisältää 1–4 pisteen pysty- ja ristikkotiheyksiä, tiukkoja kaaria, pieniä kirjaimia ja pisteitä, mustavalkoisella rasterilla tehtyjä 0/25/50/75/100 % harmaasävyruutuja sekä vuorottelevia tummia palkkeja. Kuittipalvelu ei saa erillisiä harmaatasoja: sävyt muodostuvat mustien pisteiden tiheydestä. Kun tulostin on käytössä, sama valittu node voidaan lähettää **PRINT RECEIPT** -painikkeella.

## Paperi ja tulostin

- Epsonin mukaan 80 mm:n paperin todellinen leveys on 79,5 ± 0,5 mm, rullan suurin halkaisija 83 mm ja hylsyn sisähalkaisija 12 mm. Tulostettava alue on 512 pistettä eli noin 72 mm. Tarkista rullan hylsy ja lämpöherkkä puoli ennen hankintaa. [TM-T88V Technical Reference Guide](https://download4.epson.biz/sec_pubs/bs/pdf/TM-T88V_trg_en_revG.pdf)
- Ohjelma käyttää ESC/POSin `GS v 0` -kuvakomentoa. Tavallisen kuitin leikkaus käyttää `GS V 65 32` -komentoa: tulostin syöttää paperin leikkuriin, lisää 32 pisteen marginaalin ja leikkaa. Alkuperäinen kiinteä 112 pisteen syöttö leikkasi ensimmäisen laitetestin kuvion keskeltä. Erillinen **Cut paper** lähettää vain `GS V 0` -komennon eikä syötä paperia. TM-T88V jättää leikatun kuitin reunaan pienen kiinnikkeen; tämä on mallin normaali osittaisleikkaus. [Epsonin leikkauskomennot](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_cv.html), [TM-T88V Technical Reference Guide](https://download4.epson.biz/sec_pubs/bs/pdf/TM-T88V_trg_en_revG.pdf)
- Lähtökohtana on 80 mm:n paperiasetus. Jos käytetty tulostin on vaihdettu 58 mm:n asetukseen, 512 pisteen kuva ei mahdu; varmista asetukset itsetestitulosteesta.

## Raspberry Pi -asennus

Pi:lle riittää Python 3:n vakiokirjasto. Tiedostot asennetaan `print`-käyttäjän kotihakemiston `muusia-print`-kansioon. Lisää käyttäjä ensin `lp`-ryhmään komennolla `sudo usermod -aG lp print` ja avaa uusi SSH-istunto. `setup-pi.sh` laittaa uuden asennuksen kirjoittamaan kuivatestissä `test-output.escpos`-tiedostoon. Palvelu kuuntelee vain Pi:n omassa `127.0.0.1:8631`-osoitteessa; sitä ei voi avata suoraan lähiverkosta. Käyttäjäpalvelu käynnistää Pythonin `lp`-ryhmässä ilman koko käyttäjäistunnon katkaisua.

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

Jono ja työhistoria ovat Pi:n muistissa: palvelun uudelleenkäynnistys tyhjentää ne. Yksittäinen kuva saa olla enintään 512 × 4096 pistettä. Jonoon mahtuu 64 odottavaa työtä ja historiaan 100 työtä. `done` tarkoittaa, että ESC/POS-tavut on kirjoitettu tiedostoon tai USB-laitteelle; se ei todista paperitulosteen laatua. Kuivatestitiedostoon kertyy kaikkien töiden tavut peräkkäin.

## USB-tulostus

Tällä Pi:llä Epson näkyy USB-tunnisteella `04b8:0202`, tuotteen nimi on `TM-T88V` ja laitepolku on `/dev/usb/lp0`. Palvelun ympäristötiedostossa `~/.config/muusia-print.env` on `MUUSIA_PRINT_DEVICE=/dev/usb/lp0`, eikä kuivatestin `MUUSIA_PRINT_OUTPUT_FILE` ole enää käytössä. Jos tulostin irrotetaan tai laitepolku vaihtuu, tarkista `lsusb`, `ls -l /dev/usb/lp*`, `systemctl --user status muusia-print.service` ja `journalctl --user -u muusia-print.service -n 50`. Uudella Pi-asennuksella vaihda ympäristötiedoston kuivatestirivi USB-laitepolkuun vasta, kun laite tunnistuu.

Muusiassa valitse pieni viivapiirros ja jätä Mega Canvas pois. Tulostus skaalautuu 72 mm:n tulostusleveyteen. Enimmäispituus on noin 58 cm; aloita paljon lyhyemmällä kuvalla. Käytä tämän Macin palvelinosoitetta `http://127.0.0.1:8633`. Tulostussivun työt kulkevat saman palvelun kautta. Yhteys tarvitsee käynnissä olevan SSH-tunnelin, mutta ei tulostustunnusta.

## Rajat ja seuraava vaihe

Muusian oma tulostuspolku käsittelee viivat mustina riippumatta kynäväristä. Dashboardin kuvat muunnetaan mustavalkoisiksi selaimessa. Palvelun `done` kertoo, että tavut menivät USB-laitteelle; Epsonin oma tila ja paperin loppuminen eivät vielä palaudu sivulle. Pi on raportoinut arvon `throttled=0x50005` eli ajoittaista alijännitettä ja hidastumista. [Raspberry Pi:n virtalähdesuositus Pi 3:lle](https://www.raspberrypi.com/documentation/computers/getting-started.html)
