import json
import tempfile
import fitz
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from openai import OpenAI
import os

key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=key)
app = FastAPI(title = "PDF Parser")

def extract_text(pdf_path):
    doc = fitz.open(pdf_path)
    return "\n".join(f"\n--- Page {i+1} ---\n{p.get_text()}" for i, p in enumerate(doc))

def parse_text(mock_text):
    prompt = f"""
You are a biomedical report parser.
Extract key DEXA scan information and return JSON:

{{
  "individuals": [
    {{
      "individual_id": "string",
      "species": "mouse or human",
      "sex": "M/F",
      "age": "e.g. 10 weeks",
      "genotype": "WT/KO/etc",
      "experiment_type": "longitudinal or single_time",
      "measurements": [
        {{"name": "measurement name", "value": 123, "units": "mg/dL"}}
      ]
    }}
  ]
}}

Report text:
{mock_text}
"""
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0
    )
    return json.loads(resp.choices[0].message.content)

# ---- MOCK REPORT ----
mock_report = """
DEXA Scan Report - Washington University School of Medicine

Mouse ID: M123
Species: Mouse
Sex: Female
Age: 12 weeks
Genotype: KO
Experiment: Longitudinal bone density study

Measurements:
Bone Mineral Density (BMD): 0.056 g/cm^2
Fat Mass: 3.2 g
Lean Mass: 18.5 g

Previous scans performed at 4 and 8 weeks. Current scan at 12 weeks.
"""

if __name__ == "__main__":
    result = parse_text(mock_report)
    print(json.dumps(result, indent=2))