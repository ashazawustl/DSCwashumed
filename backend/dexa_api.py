from flask import Flask, request, jsonify, send_file
import pandas as pd
import numpy as np
from pathlib import Path
from PIL import Image
import os
import tempfile
import uuid
from datetime import datetime
import io
import zipfile

app = Flask(__name__)

# Configure upload folder
UPLOAD_FOLDER = Path("temp_uploads")
UPLOAD_FOLDER.mkdir(exist_ok=True)

# Copy your exact functions from the notebook
def standardize_timepoints(df):
    """Standardize timepoint names across all batches"""
    df_standardized = df.copy()
    
    timepoint_mapping = {
        'Week_0': 'Baseline',
        'Pre_Scan': 'Baseline',
        'Week_1': 'Week_1',
        'Week_2': 'Week_2',
        'Week_3': 'Week_3',
        'Post_Scan': 'Post_Scan',
        'Root': 'Unknown'
    }
    
    df_standardized['timepoint_standardized'] = df_standardized['timepoint'].map(timepoint_mapping)
    df_standardized['timepoint_original'] = df_standardized['timepoint']
    
    # Handle any unmapped timepoints
    unmapped = df_standardized['timepoint_standardized'].isnull()
    if unmapped.any():
        df_standardized.loc[unmapped, 'timepoint_standardized'] = df_standardized.loc[unmapped, 'timepoint_original']
    
    return df_standardized

def parse_dexa_file(file_content, filename):
    """Parse individual DEXA .txt file content"""
    lines = file_content.decode('utf-8').strip().split('\n')
    
    # Extract subject ID from filename
    subject_id = filename.split('.')[0]
    
    # Parse measurements from file content
    measurements = {}
    for line in lines:
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip().lower().replace(' ', '_')
            try:
                measurements[key] = float(value.strip())
            except ValueError:
                measurements[key] = value.strip()
    
    # Create standardized row
    row = {
        'batch': 'Uploaded_Batch',  # Will be updated based on user input
        'subject_id': subject_id,
        'timepoint': 'Pre_Scan',   # Default, can be updated
        'gender': 'Unknown',       # Will need user input
        'filename': filename,
        'total_weight': measurements.get('total_weight', 0),
        'soft_weight': measurements.get('soft_weight', 0),
        'lean_weight': measurements.get('lean_weight', 0),
        'fat_weight': measurements.get('fat_weight', 0),
        'fat_percent': measurements.get('fat_percent', 0),
        'bmc': measurements.get('bmc', 0),
        'bmd': measurements.get('bmd', 0),
        'bone_area': measurements.get('bone_area', 0),
        'sample_area': measurements.get('sample_area', 0)
    }
    
    return row

@app.route('/api/process-dexa', methods=['POST'])
def process_dexa_files():
    """Process uploaded DEXA files using your unified format logic"""
    try:
        # Get uploaded files
        files = request.files.getlist('files')
        
        if not files:
            return jsonify({"status": "error", "error": "No files uploaded"}), 400
        
        # Process each file
        all_data = []
        for file in files:
            if file.filename == '':
                continue
                
            # Parse file content
            file_content = file.read()
            parsed_row = parse_dexa_file(file_content, file.filename)
            all_data.append(parsed_row)
        
        if not all_data:
            return jsonify({"status": "error", "error": "No valid files processed"}), 400
        
        # Create DataFrame
        df = pd.DataFrame(all_data)
        
        # Apply your standardization
        standardized_df = standardize_timepoints(df)
        
        # Remove duplicates (your logic)
        original_count = len(standardized_df)
        standardized_df = standardized_df.drop_duplicates()
        duplicates_removed = original_count - len(standardized_df)
        
        # Generate unique filenames
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        
        csv_filename = f"unified_dexa_cleaned_{timestamp}_{unique_id}.csv"
        excel_filename = f"unified_dexa_analysis_{timestamp}_{unique_id}.xlsx"
        
        # Save CSV
        csv_path = UPLOAD_FOLDER / csv_filename
        standardized_df.to_csv(csv_path, index=False)
        
        # Save Excel with multiple sheets (your format)
        excel_path = UPLOAD_FOLDER / excel_filename
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # Main data
            standardized_df.to_excel(writer, sheet_name='Unified_DEXA_Data', index=False)
            
            # Summary sheet
            if len(standardized_df) > 0:
                summary = standardized_df.groupby(['batch', 'timepoint_standardized']).agg({
                    'subject_id': 'nunique',
                    'total_weight': 'mean',
                    'fat_percent': 'mean',
                    'bmd': 'mean'
                }).round(3)
                summary.to_excel(writer, sheet_name='Summary')
            
            # Metadata sheet
            metadata = pd.DataFrame([{
                'Total_Records': len(standardized_df),
                'Unique_Subjects': standardized_df['subject_id'].nunique(),
                'Batches': ', '.join(sorted(standardized_df['batch'].unique())),
                'Timepoints': ', '.join(sorted(standardized_df['timepoint_standardized'].unique())),
                'Files_Processed': len(files),
                'Duplicates_Removed': duplicates_removed,
                'Date_Created': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }])
            metadata.to_excel(writer, sheet_name='Metadata', index=False)
        
        return jsonify({
            "status": "success",
            "total_records": len(standardized_df),
            "batches_processed": standardized_df['batch'].nunique(),
            "duplicates_removed": duplicates_removed,
            "images_linked": 0,  # Not implemented for uploads yet
            "csv_download_url": f"/api/download/{csv_filename}",
            "excel_download_url": f"/api/download/{excel_filename}"
        })
        
    except Exception as e:
        print(f"Error processing files: {e}")
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/api/download/<filename>')
def download_file(filename):
    """Serve processed files for download"""
    try:
        file_path = UPLOAD_FOLDER / filename
        if file_path.exists():
            return send_file(file_path, as_attachment=True)
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 404

@app.route('/api/health')
def health_check():
    """Simple health check endpoint"""
    return jsonify({"status": "healthy", "message": "DEXA API is running"})

@app.route('/')
def index():
    """Basic info page"""
    return """
    <h1>DEXA Data Processing API</h1>
    <p>Upload DEXA files to get standardized, unified datasets</p>
    <h3>Endpoints:</h3>
    <ul>
        <li>POST /api/process-dexa - Upload and process files</li>
        <li>GET /api/download/&lt;filename&gt; - Download processed files</li>
        <li>GET /api/health - Health check</li>
    </ul>
    """

if __name__ == '__main__':
    # Clean up old files on startup
    for file in UPLOAD_FOLDER.glob("*"):
        try:
            if file.is_file() and (datetime.now() - datetime.fromtimestamp(file.stat().st_mtime)).days > 1:
                file.unlink()
        except:
            pass
    
    print("🚀 DEXA Processing API starting...")
    print("📊 Using your unified format logic")
    print("🌐 Access at: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
