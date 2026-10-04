"""Prototip veri setini açık kaynaklardan üretir: data/countries.json

Kaynaklar:
- Wikidata (CC0): BM üyesi 193 devlet + gözlemci Filistin ve Vatikan, Türkçe/İngilizce adlar ve alternatif adlar
- Dünya Bankası Açık Veri (CC BY 4.0): nüfus, yüzölçümü, GSYH (yayımlanmış en güncel değer)

Kullanım: python3 tools/build_data.py
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "countries.json"
UA = "TahminOyunuPrototip/0.1"

SPARQL = """
SELECT ?iso ?tr ?en ?pop ?area
  (GROUP_CONCAT(DISTINCT ?altTr; separator="|") AS ?altsTr)
  (GROUP_CONCAT(DISTINCT ?altEn; separator="|") AS ?altsEn) WHERE {
  { ?c p:P463 ?st . ?st ps:P463 wd:Q1065 . FILTER NOT EXISTS { ?st pq:P582 ?end } }
  UNION { VALUES ?c { wd:Q237 wd:Q219060 wd:Q35 } }
  ?c wdt:P298 ?iso .
  FILTER NOT EXISTS { ?c wdt:P576 ?dissolved }
  OPTIONAL { ?c wdt:P1082 ?pop }
  OPTIONAL { ?c wdt:P2046 ?area }
  OPTIONAL { ?c rdfs:label ?tr FILTER(LANG(?tr)="tr") }
  OPTIONAL { ?c rdfs:label ?en FILTER(LANG(?en)="en") }
  OPTIONAL { ?c skos:altLabel ?altTr FILTER(LANG(?altTr)="tr") }
  OPTIONAL { ?c skos:altLabel ?altEn FILTER(LANG(?altEn)="en") }
} GROUP BY ?iso ?tr ?en ?pop ?area
"""

# Dünya Bankası göstergeleri
INDICATORS = {
    "population": "SP.POP.TOTL",
    "area": "AG.SRF.TOTL.K2",
    "gdp": "NY.GDP.MKTP.CD",
}

# Wikidata etiketinin oyunda kullanılan addan farklı olduğu durumlar
NAME_OVERRIDES = {
    "CHN": "Çin",
    "USA": "Amerika Birleşik Devletleri",
    "GBR": "Birleşik Krallık",
    "COD": "Demokratik Kongo Cumhuriyeti",
    "COG": "Kongo Cumhuriyeti",
    "VAT": "Vatikan",
    "PSE": "Filistin",
    "DNK": "Danimarka",
    "NLD": "Hollanda",
}

# Türkçede yaygın kullanılan ek adlar
EXTRA_ALIASES = {
    "USA": ["ABD", "Amerika", "Birleşik Devletler"],
    "GBR": ["İngiltere", "Büyük Britanya", "UK"],
    "CZE": ["Çekya", "Çek Cumhuriyeti"],
    "KOR": ["Güney Kore"],
    "PRK": ["Kuzey Kore"],
    "ARE": ["BAE", "Birleşik Arap Emirlikleri"],
    "COD": ["Kongo DC", "Demokratik Kongo", "Kongo Kinşasa"],
    "COG": ["Kongo Brazzaville"],
    "RUS": ["Rusya"],
    "CHN": ["Çin Halk Cumhuriyeti"],
    "MKD": ["Makedonya", "Kuzey Makedonya"],
    "MMR": ["Burma", "Myanmar"],
    "CIV": ["Fildişi Sahili"],
    "SAU": ["Suudi Arabistan", "Arabistan"],
    "ZAF": ["Güney Afrika"],
    "BIH": ["Bosna", "Bosna Hersek"],
    "VAT": ["Vatikan Şehir Devleti"],
}


def get_json(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return json.load(res)
        except urllib.error.HTTPError as err:
            # Wikidata yoğun dönemlerde dakikada bir istekle sınırlıyor
            if err.code != 429 or attempt == 3:
                raise
            print("İstek sınırı, 65 saniye bekleniyor...")
            time.sleep(65)


def fetch_wikidata():
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": SPARQL})
    rows = get_json(url, {"Accept": "application/sparql-results+json"})["results"]["bindings"]
    out = {}
    for row in rows:
        iso = row["iso"]["value"]
        get = lambda key: row[key]["value"] if key in row else ""
        prev = out.get(iso)
        entry = {
            "tr": get("tr"),
            "en": get("en"),
            "alts": [a for a in (get("altsTr") + "|" + get("altsEn")).split("|") if a],
            "wd_pop": float(get("pop")) if get("pop") else None,
            "wd_area": float(get("area")) if get("area") else None,
        }
        # Aynı ülke için birden fazla nüfus değeri dönerse en büyüğünü tut
        if prev and (prev["wd_pop"] or 0) >= (entry["wd_pop"] or 0):
            continue
        out[iso] = entry
    return out


def fetch_indicator(code):
    url = f"https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&mrnev=1&per_page=400"
    rows = get_json(url)[1]
    return {r["countryiso3code"]: (r["value"], r["date"]) for r in rows if r["countryiso3code"] and r["value"] is not None}


def main():
    wd = fetch_wikidata()
    wb = {key: fetch_indicator(code) for key, code in INDICATORS.items()}

    countries = []
    for iso, info in sorted(wd.items()):
        values, years = {}, {}
        for key in INDICATORS:
            if iso in wb[key]:
                values[key], years[key] = wb[key][iso][0], wb[key][iso][1]
        # Dünya Bankası'nda bulunmayan Vatikan için Wikidata değerleri
        if "population" not in values and info["wd_pop"]:
            values["population"], years["population"] = info["wd_pop"], "wikidata"
        if "area" not in values and info["wd_area"]:
            values["area"], years["area"] = info["wd_area"], "wikidata"

        name = NAME_OVERRIDES.get(iso, info["tr"])
        aliases = []
        for alias in [info["tr"], info["en"], *EXTRA_ALIASES.get(iso, []), *info["alts"]]:
            if alias and alias != name and alias not in aliases:
                aliases.append(alias)
        countries.append({"id": iso, "name": name, "en": info["en"], "aliases": aliases, "values": values, "years": years})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"countries": countries}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(countries)} ülke yazıldı: {OUT}")
    for key in INDICATORS:
        print(key, "eksik:", [c["id"] for c in countries if key not in c["values"]])


if __name__ == "__main__":
    main()
