"""
DEXA Data Processing API

This Flask API processes uploaded DEXA scan files and standardizes them
using the unified format logic from our batch processing notebooks.

Features:
- File upload and processing
- Timepoint standardization across batches
- Duplicate removal
- CSV and Excel export with summary sheets
- Temporary file cleanup

TODO:
- Add file validation and error handling
- Implement batch detection from filenames
- Add image metadata integration
- Optimize for larger file uploads
"""

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

# Configure upload folder for temporary file storage
UPLOAD_FOLDER = Path("temp_uploads")
UPLOAD_FOLDER.mkdir(exist_ok=True)

# Copy exact functions from the unified format notebook
def standardize_timepoints(df):
    """
    Standardize timepoint names across all batches for consistency.
    
    Args:
        df (DataFrame): Input DataFrame with timepoint column
        
    Returns:
        DataFrame: DataFrame with standardized timepoint columns
        
    Note:
        Maps batch-specific timepoint names to unified naming convention:
        - Week_0/Pre_Scan -> Baseline
        - Week_1, Week_2, Week_3 remain unchanged
        - Post_Scan remains unchanged
        - Root -> Unknown
    """
    df_standardized = df.copy()
    
    # Mapping dictionary for timepoint standardization
    timepoint_mapping = {
        'Week_0': 'Baseline',      # Batch 1 baseline
        'Pre_Scan': 'Baseline',    # Batches 2-5 baseline
        'Week_1': 'Week_1',
        'Week_2': 'Week_2',
        'Week_3': 'Week_3',
        'Post_Scan': 'Post_Scan',
        'Root': 'Unknown'          # Edge case handling
    }
    
    # Apply mapping to create standardized timepoint column
    df_standardized['timepoint_standardized'] = df_standardized['timepoint'].map(timepoint_mapping)
    df_standardized['timepoint_original'] = df_standardized['timepoint']
    
    # Handle any unmapped timepoints by keeping original value
    unmapped = df_standardized['timepoint_standardized'].isnull()
    if unmapped.any():
        df_standardized.loc[unmapped, 'timepoint_standardized'] = df_standardized.loc[unmapped, 'timepoint_original']
    
    return df_standardized

def parse_dexa_file(file_content, filename):
    """
    Parse individual DEXA .txt file content into standardized format.
    
    Args:
        file_content (bytes): Raw file content from uploaded file
        filename (str): Original filename for subject ID extraction
        
    Returns:
        dict: Standardized row with DEXA measurements
        
    TODO:
        - Add validation for required DEXA fields
        - Handle different file formats (CSV, different txt structures)
        - Improve subject ID extraction logic
    """
    # Decode file content and split into lines
    lines = file_content.decode('utf-8').strip().split('\n')
    
    # Extract subject ID from filename (assumes format: subjectID.extension)
    subject_id = filename.split('.')[0]
    
    # Parse measurements from file content
    # Expects format: "measurement_name: value"
    measurements = {}
    for line in lines:
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip().lower().replace(' ', '_')
            try:
                measurements[key] = float(value.strip())
            except ValueError:
                # Keep as string if not numeric
                measurements[key] = value.strip()
    
    # Create standardized row matching our unified format
    row = {
        'batch': 'Uploaded_Batch',  # TODO: Detect batch from filename or user input
        'subject_id': subject_id,
        'timepoint': 'Pre_Scan',   # TODO: Allow user to specify timepoint
        'gender': 'Unknown',       # TODO: Extract from filename or user input
        'filename': filename,
        # DEXA measurement fields
        'total_weight': measurements.get('total_weight', 0),
        'soft_weight': measurements.get('soft_weight', 0),
        'lean_weight': measurements.get('lean_weight', 0),
        'fat_weight': measurements.get('fat_weight', 0),
        'fat_percent': measurements.get('fat_percent', 0),
        'bmc': measurements.get('bmc', 0),           # Bone Mineral Content
        'bmd': measurements.get('bmd', 0),           # Bone Mineral Density
        'bone_area': measurements.get('bone_area', 0),
        'sample_area': measurements.get('sample_area', 0)
    }
    
    return row

@app.route('/api/process-dexa', methods=['POST'])
def process_dexa_files():
    """
    Process uploaded DEXA files using unified format logic.
    
    Accepts multipart/form-data with 'files' containing DEXA scan files.
    Returns JSON response with processing results and download URLs.
    
    Returns:
        JSON: Success response with file URLs or error message
        
    TODO:
        - Add file size limits and validation
        - Implement batch detection from filenames
        - Add progress tracking for multiple files
        - Enhance error handling and user feedback
    """
    try:
        # Get uploaded files from request
        files = request.files.getlist('files')
        
        if not files:
            return jsonify({
                "status": "error", 
                "error": "No files uploaded"
            }), 400
        
        # Process each uploaded file
        all_data = []
        for file in files:
            if file.filename == '':
                continue
                
            # Parse file content using our DEXA parser
            file_content = file.read()
            parsed_row = parse_dexa_file(file_content, file.filename)
            all_data.append(parsed_row)
        
        if not all_data:
            return jsonify({
                "status": "error", 
                "error": "No valid files processed"
            }), 400
        
        # Create DataFrame from parsed data
        df = pd.DataFrame(all_data)
        
        # Apply timepoint standardization (same logic as notebook)
        standardized_df = standardize_timepoints(df)
        
        # Remove duplicates using our established logic
        original_count = len(standardized_df)
        standardized_df = standardized_df.drop_duplicates()
        duplicates_removed = original_count - len(standardized_df)
        
        # Generate unique filenames for output files
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        
        csv_filename = f"unified_dexa_cleaned_{timestamp}_{unique_id}.csv"
        excel_filename = f"unified_dexa_analysis_{timestamp}_{unique_id}.xlsx"
        
        # Save CSV output
        csv_path = UPLOAD_FOLDER / csv_filename
        standardized_df.to_csv(csv_path, index=False)
        
        # Save Excel with multiple sheets (matches notebook format)
        excel_path = UPLOAD_FOLDER / excel_filename
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # Main unified data sheet
            standardized_df.to_excel(writer, sheet_name='Unified_DEXA_Data', index=False)
            
            # Summary sheet with aggregated statistics
            if len(standardized_df) > 0:
                summary = standardized_df.groupby(['batch', 'timepoint_standardized']).agg({
                    'subject_id': 'nunique',
                    'total_weight': 'mean',
                    'fat_percent': 'mean',
                    'bmd': 'mean'
                }).round(3)
                summary.to_excel(writer, sheet_name='Summary')
            
            # Metadata sheet with processing information
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
        
        # Return success response with download URLs
        return jsonify({
            "status": "success",
            "total_records": len(standardized_df),
            "batches_processed": standardized_df['batch'].nunique(),
            "duplicates_removed": duplicates_removed,
            "images_linked": 0,  # TODO: Implement image processing for uploads
            "csv_download_url": f"/api/download/{csv_filename}",
            "excel_download_url": f"/api/download/{excel_filename}"
        })
        
    except Exception as e:
        # Log error for debugging
        app.logger.error(f"Error processing files: {e}")
        return jsonify({
            "status": "error", 
            "error": str(e)
        }), 500

@app.route('/api/download/<filename>')
def download_file(filename):
    """
    Serve processed files for download.
    
    Args:
        filename (str): Name of the file to download
        
    Returns:
        File: File attachment for download or error response
    """
    try:
        file_path = UPLOAD_FOLDER / filename
        if file_path.exists():
            return send_file(file_path, as_attachment=True)
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception as e:
        app.logger.error(f"Error serving file {filename}: {e}")
        return jsonify({"error": str(e)}), 404

@app.route('/api/health')
def health_check():
    """Simple health check endpoint for monitoring API status."""
    return jsonify({
        "status": "healthy", 
        "message": "DEXA API is running",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/')
def index():
    """Basic API information page."""
    return """
    <h1>DEXA Data Processing API</h1>
    <p>Upload DEXA files to get standardized, unified datasets</p>
    <h3>Available Endpoints:</h3>
    <ul>
        <li><strong>POST /api/process-dexa</strong> - Upload and process DEXA files</li>
        <li><strong>GET /api/download/&lt;filename&gt;</strong> - Download processed files</li>
        <li><strong>GET /api/health</strong> - Health check</li>
    </ul>
    <h3>Input Format:</h3>
    <p>Accepts .txt files with DEXA measurements in "key: value" format</p>
    <h3>Output Format:</h3>
    <p>Returns standardized CSV and Excel files with unified timepoint naming</p>
    """

if __name__ == '__main__':
    # Clean up old temporary files on startup (older than 1 day)
    for file in UPLOAD_FOLDER.glob("*"):
        try:
            if file.is_file() and (datetime.now() - datetime.fromtimestamp(file.stat().st_mtime)).days > 1:
                file.unlink()
        except Exception as e:
            app.logger.warning(f"Could not clean up file {file}: {e}")
    
    # Start Flask development server
    print("DEXA Processing API starting...")
    print("Using unified format logic from batch processing notebooks")
    print("Access at: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
