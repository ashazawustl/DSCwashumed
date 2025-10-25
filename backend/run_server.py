from flask import Flask, jsonify
import subprocess

app = Flask(__name__)

@app.route("/run-correlation", methods=["GET"])
def run_correlation():
    try:
        subprocess.run(
            ["python3", "/Users/shazaali/Desktop/DSCwashumed/backend/run_stat_test.py"],
            check=True
        )
        return jsonify({"status": "success", "message": "Pearson/Spearman notebook executed successfully."})
    except subprocess.CalledProcessError as e:
        return jsonify({"status": "error", "message": str(e)}), 500
