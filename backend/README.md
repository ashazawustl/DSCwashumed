# DEXA Data Processing API

A Flask-based API for processing and standardizing DEXA scan files using our unified format logic.

## Overview

This API allows users to upload DEXA scan files and receive standardized, cleaned datasets in both CSV and Excel formats. It implements the same data processing logic used in our batch processing notebooks.

## Features

- File upload and processing for DEXA scan data
- Timepoint standardization across different batch formats
- Automatic duplicate removal
- Multi-sheet Excel export with summary statistics
- Temporary file management and cleanup

## API Endpoints

### `POST /api/process-dexa`
Upload and process DEXA files.

**Request Format:**
- Content-Type: `multipart/form-data`
- Form field: `files` (multiple .txt files supported)

**Response Format:**
```json
{
  "status": "success",
  "total_records": 296,
  "batches_processed": 1,
  "duplicates_removed": 0,
  "images_linked": 0,
  "csv_download_url": "/api/download/unified_dexa_cleaned_20241016_143025_a1b2c3d4.csv",
  "excel_download_url": "/api/download/unified_dexa_analysis_20241016_143025_a1b2c3d4.xlsx"
}
```

### `GET /api/download/<filename>`
Download processed files.

### `GET /api/health`
Health check endpoint.

## Setup and Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the API:
```bash
python dexa_api.py
```

3. Access at: http://localhost:5000

## Input File Format

The API expects .txt files with DEXA measurements in the following format:
```
Total Weight: 33.61
Soft Weight: 32.89
Lean Weight: 24.33
Fat Weight: 8.56
Fat Percent: 25.97
BMC: 0.72
BMD: 80.06
Bone Area: 8.99
Sample Area: 31.21
```

## Output Format

### CSV Output
Standardized CSV with columns:
- `batch`, `subject_id`, `timepoint_standardized`, `gender`
- `total_weight`, `soft_weight`, `lean_weight`, `fat_weight`, `fat_percent`
- `bmc`, `bmd`, `bone_area`, `sample_area`
- `timepoint_original`, `filename`

### Excel Output
Multi-sheet workbook containing:
- **Unified_DEXA_Data**: Main dataset
- **Summary**: Aggregated statistics by batch and timepoint
- **Metadata**: Processing information and record counts

## Timepoint Standardization

The API standardizes timepoint names across different batch formats:
- `Week_0` → `Baseline`
- `Pre_Scan` → `Baseline`
- `Week_1`, `Week_2`, `Week_3` → Unchanged
- `Post_Scan` → Unchanged
- `Root` → `Unknown`

## Current Limitations

- Designed specifically for DEXA scan files
- Expects "key: value" format in .txt files
- Default values for batch, timepoint, and gender (needs user input)
- Image metadata integration not yet implemented
- No file size limits or advanced validation

## TODO Items

- [ ] Add file validation and size limits
- [ ] Implement batch detection from filenames
- [ ] Add user input for timepoint and gender assignment
- [ ] Integrate image metadata processing
- [ ] Add progress tracking for multiple file uploads
- [ ] Implement authentication and user sessions
- [ ] Add support for different file formats (CSV, Excel)

## Development Notes

This API implements the same data processing logic as our batch processing notebooks (`unifiedformat.ipynb`). The core functions `standardize_timepoints()` and data parsing logic are directly adapted from the notebook implementation.

For integration with the existing website, the API can be incorporated into the current backend infrastructure or run as a separate microservice.
