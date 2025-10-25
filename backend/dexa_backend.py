from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
import pandas as pd

app = Flask(__name__)

UPLOAD_FOLDER = "/Users/shazaali/Desktop/DSCwashumed/backend/uploads"
OUTPUT_FOLDER = "/Users/shazaali/Desktop/DSCwashumed/backend/outputs"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'txt', 'csv', 'xlsx', 'xls'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/api/process-dexa", methods=["POST"])
def process_dexa():
    if 'files' not in request.files:
        return jsonify({"status": "error", "error": "No files uploaded"}), 400

    uploaded_files = request.files.getlist("files")

    if not uploaded_files:
        return jsonify({"status": "error", "error": "No files found"}), 400

    processed_files = []
    total_records = 0

    for file in uploaded_files[:20]:  # enforce 20-file limit
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            save_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(save_path)
            processed_files.append(filename)

            try:
                # Example: load and count rows (simple cleaning example)
                if filename.endswith((".xlsx", ".xls")):
                    df = pd.read_excel(save_path)
                else:
                    df = pd.read_csv(save_path)

                # Example cleanup: remove "TEST" rows
                test_rows_removed = df[df.apply(lambda r: r.astype(str).str.contains("TEST", case=False).any(), axis=1)].shape[0]
                df = df[~df.apply(lambda r: r.astype(str).str.contains("TEST", case=False).any(), axis=1)]

                total_records += len(df)

                # Save cleaned file
                output_filename = f"cleaned_{filename.rsplit('.',1)[0]}.csv"
                output_path = os.path.join(OUTPUT_FOLDER, output_filename)
                df.to_csv(output_path, index=False)

            except Exception as e:
                return jsonify({"status": "error", "error": f"Error processing {filename}: {e}"}), 500

    response = {
        "status": "success",
        "files_processed": processed_files,
        "total_records": total_records,
        "csv_download_url": f"http://localhost:5001/download/cleaned_{processed_files[0].rsplit('.',1)[0]}.csv" if processed_files else "",
        "csv_filename": f"cleaned_{processed_files[0].rsplit('.',1)[0]}.csv" if processed_files else ""
    }

    return jsonify(response)


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    return send_from_directory(OUTPUT_FOLDER, filename, as_attachment=True)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
