# Muusia Print: Raspberry Pi -tulostussivu

Tila 9.11.2026: Muusian valitun solmun viivat voidaan rasteroida 512 pisteen levyiseksi mustavalkoiseksi kuittikuvaksi. Raspberry Pi:n Muusia Print -sivulla voi esikatsella kuitteja, kuvia, tekstiä ja testikorttia sekä lisätä niitä tulostusjonoon. Ilman Epsonia palvelin toimii kuivatestitilassa ja tallentaa ESC/POS-komennot tiedostoon. Epson TM-T88V:tä ei ole vielä kytketty tai testattu.

`DOWNLOAD RECEIPT FILE` tallentaa saman bittikuvan `*.muusia-receipt.json`-tiedostoksi ilman tulostinta. Tiedosto sisältää `format`, `version`, `width`, `height`, Base64-muotoisen 1-bittisen `data`-kentän ja `cut`-valinnan. Latu näyttää tiedoston kohdasta **Document → Open receipt preview…**. Latu voi myös avata tämän palvelimen tuottaman `.escpos`-tavuvirran esikatseluun; kumpaakaan muotoa ei tulkita G-codeksi tai muokattaviksi viivoiksi.

## Kuittikangas Muusiassa

Valitse yläpalkin **Size preset → Receipt · 72 × 100 mm** lyhyelle kuitille tai **Receipt strip · 72 × 250 mm** pidemmälle nauhalle. Voit myös asettaa Canvas-leveydeksi **72 mm** ja korkeudeksi haluamasi kuittipituuden. 80 mm:n rullassa tulostettava alue on noin 72 mm; Muusia skaalaa koko kankaan leveyden 512 pisteeseen. Valitse tulostettava solmu, pidä **Mega Canvas** pois päältä ja käytä **DOWNLOAD RECEIPT FILE** -painiketta Latu-esikatseluun. Tämä ei tarvitse Epsonia, Raspberry Pi:tä eikä tokenia.

Animaatiolle aseta **ANIMATE → Frames**, valitse tulostettava solmu ja paina **Receipt × N**. Muusia laskee jokaisen freimin erikseen ja lataa ne yhtenä ZIP-pakettina (`*.muusia-receipt.json` per freimi; yhdestä freimistä tulee yksittäinen tiedosto). Jokaisen kuvan yläreunaan rasteroidaan pieni `F01/12`-tyyppinen numero ja kuvan alkuun ja loppuun lyhyet leikkausmerkit. Merkit lisäävät kuittiin 30 pisteriviä eli noin 4 mm. ZIP:n yksittäiset tiedostot avautuvat Latussa kuten tavallinen kuitti. Muusia ei lähetä koko animaatiota tulostusjonoon automaattisesti.

Latussa voit avata myös koko animaation ZIP-paketin kohdasta **Document → Open receipt preview…**. Esikatselussa on Play/Pause, edellinen/seuraava freimi ja aikajana. Toisto kiertää viimeisestä freimistä takaisin ensimmäiseen.

Ensimmäistä Epsonin laitetestiä varten avaa valmis esimerkki **Help → Test Card · Thermal receipt** ja valitse sen **Test Card** -node. Vaihtoehtoisesti valitse **Size preset → Receipt · 72 × 100 mm**, lisää **Test Card** -node ja aseta **Card → Thermal receipt**. Tallenna valittu node painamalla **DOWNLOAD RECEIPT FILE**. Avaa tiedosto Latussa ennen tulostamista. Kuvio sisältää 1–4 pisteen pysty- ja ristikkotiheyksiä, tiukkoja kaaria, pieniä kirjaimia ja pisteitä, mustavalkoisella rasterilla tehtyjä 0/25/50/75/100 % harmaasävyruutuja sekä vuorottelevia tummia palkkeja. Kuittipalvelu ei saa erillisiä harmaatasoja: sävyt muodostuvat mustien pisteiden tiheydestä. Kun tulostin on käytössä, sama valittu node voidaan lähettää **PRINT RECEIPT** -painikkeella.

## Paperi ja tulostin

- Epsonin mukaan 80 mm:n paperin todellinen leveys on 79,5 ± 0,5 mm, rullan suurin halkaisija 83 mm ja hylsyn sisähalkaisija 12 mm. Tulostettava alue on 512 pistettä eli noin 72 mm. Tarkista rullan hylsy ja lämpöherkkä puoli ennen hankintaa. [TM-T88V Technical Reference Guide](https://download4.epson.biz/sec_pubs/bs/pdf/TM-T88V_trg_en_revG.pdf)
- Ohjelma käyttää ESC/POSin `GS v 0` -kuvakomentoa ja `GS V` -leikkauskomentoa. Epson merkitsee `GS v 0`:n vanhentuneeksi mutta TM-T88V:n tukemaksi; uudempi grafiikkakomento on jatkokehityksen vaihtoehto. [TM-T88V:n komennot](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/tmt88v.html)
- Lähtökohtana on 80 mm:n paperiasetus. Jos käytetty tulostin on vaihdettu 58 mm:n asetukseen, 512 pisteen kuva ei mahdu; varmista asetukset itsetestitulosteesta.

## Raspberry Pi -asennus

Pi:lle riittää Python 3:n vakiokirjasto. Tiedostot asennetaan `print`-käyttäjän kotihakemiston `muusia-print`-kansioon. `setup-pi.sh` luo oman satunnaisen tunnuksen ja laittaa palvelun kirjoittamaan kuivatestissä `test-output.escpos`-tiedostoon. Tunnusta ei tallenneta Git-repositorioon. Palvelu kuuntelee Pi:n omassa `127.0.0.1:8631`-osoitteessa.

```sh
cd ~/muusia-print
sh setup-pi.sh
loginctl enable-linger print
```

Viimeinen komento pitää käyttäjäpalvelun käynnissä uloskirjautumisen jälkeen ja käynnistää sen Pi:n käynnistyessä. Sen jälkeen Macilla avataan tunneli:

```sh
ssh -N -L 8633:127.0.0.1:8631 print@print.local
```

Avaa selaimessa `http://127.0.0.1:8633/`. Tämän Macin portti 8631 on varattu toiselle ohjelmalle, joten tunnelin paikallinen portti on 8633. Sivun pyytämä tunnus löytyy Pi:llä tiedostosta `~/.config/muusia-print.env` riviltä `MUUSIA_PRINT_TOKEN=...`. Muusian `PRINT RECEIPT` käyttää samaa Macin osoitetta ja tunnusta. Sivun tunnus säilyy selaimen tämän välilehden istunnossa. Tunnelin kautta tulostussivu ei avaudu muulle lähiverkolle.

## Tulostussivu

- **Receipt file** avaa yksittäisen Muusian `.muusia-receipt.json`-tiedoston tai animaation ZIP-paketin. Kaikkia freimejä voi selata ja jonottaa yksittäin tai järjestyksessä.
- **Image** avaa PNG-, JPEG- tai WebP-kuvan, sovittaa sen 512 pisteen leveyteen ja muuntaa sen mustavalkoiseksi pistekuvaksi. Valittavana on kynnys tai dithering.
- **Text** tekee yksinkertaisen tekstikuitin selaimessa.
- **Test card** luo tiheät viivat, ruudukot, kaaret, harmaasävyruudut ja tummat palkit Epsonin ensimmäistä laitetestiä varten.
- **Print queue** näyttää odottavat, käynnissä olevat ja valmistuneet työt. Odottavan työn voi perua, ja aiemman työn esikatsella tai lisätä jonoon uudelleen.

Jono ja työhistoria ovat Pi:n muistissa: palvelun uudelleenkäynnistys tyhjentää ne. Yksittäinen kuva saa olla enintään 512 × 4096 pistettä. Jonoon mahtuu 64 odottavaa työtä ja historiaan 100 työtä. `done` tarkoittaa, että ESC/POS-tavut on kirjoitettu tiedostoon tai USB-laitteelle; se ei todista paperitulosteen laatua. Kuivatestitiedostoon kertyy kaikkien töiden tavut peräkkäin.

## Ensimmäinen laitetesti

1. Kun Epson on hankittu, varmista tulostimen omalla itsetestillä paperi, USB-tila ja automaattileikkuri. Kytke 24 V virtalähde ja USB-B-kaapeli. Tarkista Pi:llä `ls -l /dev/usb/lp*`. Palvelin käyttää USB Printer Class -laitetta; TM-T88V voi olla myös Vendor Class -tilassa, jolloin `/dev/usb/lp0` ei synny. Tarkista USB-luokka tulostimen asetuksista. Varmista tarvittaessa, että `print`-käyttäjä kuuluu `lp`-ryhmään. [Epsonin USB-luokat](https://download4.epson.biz/sec_pubs/bs/pdf/TM-T88V_trg_en_revG.pdf)
2. Avaa Muusia, valitse pieni viivapiirros ja jätä Mega Canvas pois. Tulostus skaalautuu 72 mm:n tulostusleveyteen. Enimmäispituus on noin 58 cm; aloita paljon lyhyemmällä kuvalla.
3. Syötä palvelimen token ja paina `PRINT RECEIPT`. Halutessasi poista `Cut after print` -valinta ensimmäisessä testissä.
4. Vaihda vasta tässä vaiheessa Pi:n `~/.config/muusia-print.env`-tiedoston `MUUSIA_PRINT_OUTPUT_FILE=...`-rivi muotoon `MUUSIA_PRINT_DEVICE=/dev/usb/lp0` ja käynnistä palvelu uudelleen komennolla `systemctl --user restart muusia-print.service`. Tarkista tarvittaessa `journalctl --user -u muusia-print.service -n 50`. `/health` ja `/api/jobs/<id>` vaativat saman tunnuksen.

## Rajat ja seuraava vaihe

Muusian oma tulostuspolku käsittelee viivat mustina riippumatta kynäväristä. Dashboardin kuvat muunnetaan mustavalkoisiksi selaimessa. Epsonin USB-tila, paperin lämpöherkkä puoli, tulostusjälki, leikkuri ja tilalukeminen odottavat fyysistä laitetestiä.
