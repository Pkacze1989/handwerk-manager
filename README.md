# Werkplan

Werkplan ist eine Software für den Handwerksalltag: vom ersten Anruf über Angebot, Plantafel und Baustelle bis zur Schlussrechnung. Die Oberfläche ist deutsch, die Beträge in Euro, die Zeiten in Europe/Berlin.

Diese Installation läuft lokal mit SQLite. Es ist kein externer Dienst nötig.

## Start

```bash
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Danach im Browser `http://localhost:3000` öffnen.

Produktionsbau:

```bash
npm run build
npm start
```

Die Datenbankdatei liegt nach der Migration unter `prisma/dev.db`.

## Demo-Zugang

Passwort für alle Personen: `baustelle`

| Rolle | E-Mail |
| --- | --- |
| Büro | lena.hoffmann@bergmann-elektro.example |
| Baustelle | jonas.weber@bergmann-elektro.example |
| Inhaber | thomas.bergmann@bergmann-elektro.example |

Auf der Anmeldeseite legen „Büro öffnen“ und „Baustelle öffnen“ den passenden Zugang direkt an. Die Baustelle ist dieselbe Anwendung mit eigener Navigation fürs Handy, inklusive Web-App-Manifest. Es gibt keine nativen App-Store-Builds.

Der Seed legt den Betrieb Bergmann Elektrotechnik GmbH an: Mitarbeitende, Kunden, Lieferanten, Kataloge, eine laufende Baustelle in der Johannstadt, Belege, Zeiten, Chat, Plantafel und eine bereits ausgelesene Eingangsrechnung.

## Module

- **Büro:** Angebote, Auftragsbestätigungen, Lieferscheine, pauschale und kumulative Abschlagsrechnungen, Schlussrechnungen, Abnahme, Regie, Stundennachweis. Positionen kommen aus dem Katalog, lassen sich frei erfassen und per Ziehen sortieren. Jeder Beleg hat ein PDF.
- **E-Rechnung:** XRechnung als UBL-XML und ZUGFeRD als PDF mit eingebetteter CII-XML (`factur-x.xml`, Beziehung Alternative). Das ist eine brauchbare Struktur, kein Kosit-Prüfbericht und kein zertifiziertes PDF/A-3.
- **Stammdaten:** Betrieb, Kunden, Lieferanten, Material, Leistungen, Team und Ressourcen.
- **Finanzen:** offene Posten, Zahlungen, Monats- und Jahresumsatz, Zahlungserinnerung und Mahnung. Versand ist ein Postausgang in der Anwendung, optional als `mailto`.
- **KI-Angebot:** Freitext oder Transkript, optional eine Datei an der Bauakte. Die lokale Engine in `lib/ai` sucht Mengen und Katalogtreffer. Ein OpenAI-kompatibler Endpunkt ist optional (`WERKPLAN_LLM_BASE_URL`, `WERKPLAN_LLM_API_KEY`, `WERKPLAN_LLM_MODEL`). Ohne Schlüssel bleibt der lokale Entwurf.
- **Eingangsrechnungen:** Datei speichern, Text/CSV/XML auslesen, Felder korrigieren, dem Projekt zuordnen.
- **Empfang:** simulierter Anruf, strukturiertes Anliegen, Ablage bei Kunde und Projekt. Keine Telefonanlage.
- **Baustelle:** Kommen und Gehen mit den Arten Arbeit, Fahrt, Pause, Schlechtwetter, Urlaub. Aufmaß für Länge, Fläche, Volumen, Stück und eigene Formeln (eigener Parser, kein JavaScript-`eval`). Baudokumentation mit Fotos und Unterschrift. Arbeitsanweisungen aus dem Büro.
- **Bauakte:** Dokumente, abgelegte E-Mails, Dateien, Pläne, interner Chat mit Bild und @Erwähnung. Der Chat bleibt in dieser Installation. Das ist keine Zertifizierung.
- **Plantafel:** Mitarbeitende, Kolonnen, Maschinen und Fahrzeuge auf Baustellen und Zeiträume ziehen. Die Einsätze erscheinen in der mobilen Ansicht.
- **Kalkulation:** Vorkalkulation aus Material, Lohn, Gerät und Nachunternehmer mit Zuschlag und Gewinn. Nachkalkulation stellt Angebot und Faktura den gebuchten Stunden und Eingangsrechnungen gegenüber. Stände lassen sich sichern, das Projekt abschließen.

## DATEV

Unter Schnittstellen lässt sich ein Zip laden:

- `EXTF_Buchungsstapel.csv` – Windows-1252, CRLF, Semikolon. Zeile 1 ist ein EXTF-Kopf (Kennzeichen `EXTF`, Version 700, Kategorie 21, Formatname Buchungsstapel, Formatversion 9). Zeile 2 die Spalten, danach die Buchungen.
- `EXT_Debitoren.csv` und `EXT_Kreditoren.csv` – ebenfalls Windows-1252.
- `LESEN.txt` – UTF-8, dieselbe Spaltenbeschreibung.

Spalten der Buchungen:

| Spalte | Inhalt |
| --- | --- |
| Umsatz (ohne Soll/Haben-Kz) | Brutto mit Komma, ohne Tausenderpunkt |
| Soll/Haben-Kennzeichen | `S` oder `H` |
| WKZ Umsatz | `EUR` |
| Kurs, Basis-Umsatz, WKZ Basis-Umsatz | leer |
| Konto | Debitor, Aufwand oder Bank |
| Gegenkonto (ohne BU-Schlüssel) | Erlöskonto, Kreditor oder Debitor |
| BU-Schlüssel | leer, Steuer steckt in den Automatikkonten |
| Belegdatum | `TTMM` |
| Belegfeld 1 | Belegnummer |
| Belegfeld 2 | Belegdatum `JJJJMMTT` |
| Skonto | leer |
| Buchungstext | höchstens 60 Zeichen |

Logik, angelehnt an SKR 03: Ausgangsrechnung Soll Debitor an Erlös `8400`. Zahlung Soll Bank `1200` an Debitor. Eingangsrechnung Soll Aufwand `3400` an Kreditor. Konten und Beraternummer stehen in den Betriebsdaten. Das ist eine Austauschteilmenge, kein zertifizierter DATEV-Export.

## GAEB

Unterstützt wird eine Teilmenge von GAEB DA XML für die Phasen X83 (Angebot, `DP` 83) und X84 (Auftrag, `DP` 84):

- `GAEBInfo`, `PrjInfo`, `Award/BoQ`
- Bereiche `BoQCtgy` mit `RNoPart` und `LblTx`
- Positionen in `Itemlist/Item` mit `Qty`, `QU`, Kurztext (`OutlineText`), Langtext (`DetailTxt`), `UP`, `IT`

`samples/gaeb/lv-tiefgarage.x83` lässt sich einem Kunden zuordnen und wird zum Angebot. Dieselbe Struktur schreibt der Export am Beleg wieder hinaus, der Rundlauf erhält Ordnungszahl, Menge, Einheit, Text und Preis. Es gibt keine weiteren GAEB-Phasen, keine Zertifizierung und keine DA11/90-Dateien.

## DATANORM

Unterstützt wird ein lesbarer Auszug, keine volle DATANORM-4/5-Norm:

```text
V;050;A;Lieferantenname;EUR;TTMMJJJJ
A;N;Artikelnummer;Kurztext;ME;EK;VK;MwSt
```

- `V` ist der Vorlauf.
- `A` ist der Artikel. Kennzeichen `N` neu, `A` Änderung, `L` Löschung.
- Einheiten `M`, `ST`, `PAA`, `KG`, `M2`, `M3` werden auf m, Stk, psch, kg, m², m³ abgebildet.
- Dezimaltrennzeichen ist das Komma.

`samples/datanorm/elektro-nord.datanorm` ändert zwei vorhandene Preise, legt eine Feuchtraumleuchte an und löscht den Artikel `509999`. Die Vorschau zeigt den Unterschied, erst danach wird der Katalog geschrieben. Der aktuelle Katalog lässt sich im selben Format wieder herunterladen.

## Bewusst nicht enthalten

- keine Telefonanlage und kein echtes Sprachmodell, solange kein eigener API-Schlüssel gesetzt ist
- keine nativen iOS- oder Android-Apps
- keine zertifizierte XRechnung, kein PDF/A-3-Konformitätsnachweis
- keine vollständige GAEB- oder DATEV-Zertifizierung
- keine Verbindung zu einem echten Buchhaltungs- oder Großhandelssystem
