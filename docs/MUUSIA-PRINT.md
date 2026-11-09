# Muusia Print: ensimmäinen USB-tuloste

Tila 8.11.2026: Muusian valitun solmun viivat voidaan rasteroida 512 pisteen levyiseksi mustavalkoiseksi kuittikuvaksi. Erillinen Python-palvelin jonottaa tulosteet ja lähettää ne USB:n kautta Epson TM-T88V:lle. Laitetta ei ole vielä kytketty tai testattu; `PRINT RECEIPT` on valmis ensimmäiseen laitetestiin.

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

## Raspberry Pi -valmistelu

Pi:lle riittää Python 3:n vakiokirjasto. Palvelu on erillinen nykyisestä Klipperistä eikä koske sen USB-laitteisiin tai asetuksiin.

1. Kopioi `print-server/server.py` Pi:lle polkuun `~/muusia-print/server.py` ja halutessasi `print-server/muusia-print.service` polkuun `~/.config/systemd/user/muusia-print.service`.
2. Kytke tulostimen 24 V virtalähde ja USB-B-kaapeli. Tarkista Pi:llä `ls -l /dev/usb/lp*`. Palvelin käyttää USB Printer Class -laitetta; TM-T88V voi olla myös Vendor Class -tilassa, jolloin `/dev/usb/lp0` ei synny. Tarkista USB-luokka tulostimen asetuksista ennen kuin etsit vikaa palvelimesta. Varmista tarvittaessa, että käyttäjä kuuluu `lp`-ryhmään, ja kirjaudu uudelleen ryhmämuutoksen jälkeen. Älä muuta nykyisen piirturin laitepolkuja. [Epsonin USB-luokat](https://download4.epson.biz/sec_pubs/bs/pdf/TM-T88V_trg_en_revG.pdf)
3. Luo Pi:llä tunnus palvelulle:

   ```sh
   mkdir -p ~/.config
   python3 -c 'import secrets; print("MUUSIA_PRINT_TOKEN=" + secrets.token_urlsafe(32))' > ~/.config/muusia-print.env
   chmod 600 ~/.config/muusia-print.env
   ```

4. Käynnistä Pi:n käyttäjäpalvelu:

   ```sh
   systemctl --user daemon-reload
   systemctl --user enable --now muusia-print.service
   systemctl --user status muusia-print.service
   ```

Palvelin kuuntelee vain Pi:n `127.0.0.1:8631`-osoitteessa. Macilta yhteys muodostetaan SSH-tunnelilla:

```sh
ssh -N -L 8631:127.0.0.1:8631 viivain
```

Muusiassa käytetään osoitetta `http://127.0.0.1:8631` ja Pi:lle luotua tokenia. Token pidetään vain Muusian avoimen istunnon muistissa; sitä ei tallenneta projektiin. Paikallisen Vite-kehityspalvelimen, `file://`-version ja julkaistun `https://bambi8000.github.io/Muusia/`-sivun pyynnöt sallitaan, muista verkkosivustoista tulevat pyynnöt estetään. Selain lähettää GitHub Pages -alkuperäksi `https://bambi8000.github.io`. SSH-tunneli pitää Pi:n tulostusportin pois lähiverkosta.

## Ensimmäinen laitetesti

1. Varmista tulostimen omalla itsetestillä paperi, USB-tila ja automaattileikkuri. Tässä vaiheessa ei oleteta tulostimen olevan jo ostettu.
2. Avaa Muusia, valitse pieni viivapiirros ja jätä Mega Canvas pois. Tulostus skaalautuu 72 mm:n tulostusleveyteen. Enimmäispituus on noin 58 cm; aloita paljon lyhyemmällä kuvalla.
3. Syötä palvelimen token ja paina `PRINT RECEIPT`. Halutessasi poista `Cut after print` -valinta ensimmäisessä testissä.
4. Jos palvelin ilmoittaa laitevirheestä, tarkista `journalctl --user -u muusia-print.service -n 50` ja `/dev/usb/lp0`. `/health` ja `/api/jobs/<id>` vaativat saman tokenin.

Kuivatesti ilman tulostinta: käynnistä palvelin muuttujalla `MUUSIA_PRINT_OUTPUT_FILE=/tmp/muusia-print.bin`. Komennot tallentuvat tiedostoon, eivätkä mene USB-laitteelle.

## Rajat ja seuraava vaihe

Tämä ensimmäinen polku käsittelee viivat mustina riippumatta Muusian kynäväri- tai rasterikuvatasoista. Yksi työ on enintään 512 × 4096 pistettä, jono enintään kahdeksan odottavaa työtä, ja leikkaus tehdään työn lopussa. Työn `done` tarkoittaa, että tavut on annettu USB-laitteelle; se ei vielä todista tulosteen fyysistä onnistumista. Laitetestin jälkeen voidaan lisätä valokuvien dithering, pitkä jatkuva nauha, peruutus ja tulostimen tilalukeminen.
