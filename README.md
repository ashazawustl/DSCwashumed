# Enhanced DEXA Data Processing System

## Overview
Complete web-based DEXA data processing system with beautiful teal interface, advanced data cleaning, and comprehensive standardization capabilities.

## ✨ Features

### 🎨 Beautiful Teal Interface
- **Simplified Upload**: Clean 3-step workflow (Upload → Process → Download)
- **Drag & Drop**: Intuitive file upload with visual feedback
- **Glassmorphism Design**: Modern teal gradient with elegant styling
- **Responsive Layout**: Works on desktop and mobile devices

### 🔧 Enhanced Backend Processing
- **Multi-File Support**: Process up to 50 files simultaneously
- **Smart Data Cleaning**: Advanced test detection and duplicate removal
- **Intelligent Imputation**: Multiple strategies for missing data
- **Statistical Validation**: Outlier detection with IQR methods
- **Batch Standardization**: Unified naming across all data sources

### 📊 Supported File Types
- **Text/CSV**: `.txt`, `.csv` files
- **Excel**: `.xlsx`, `.xls` files  
- **PDF**: `.pdf` documents with table extraction
- **Images**: `.tif`, `.png`, `.jpeg`, `.bmp` DEXA scans

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- pip package manager

### Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Start the enhanced API server
python backend/enhanced_dexa_api.py
```

### Usage
1. **Open Browser**: Navigate to `http://localhost:5001`
2. **Upload Files**: Drag and drop your DEXA files or click to browse
3. **Auto-Processing**: Files are automatically cleaned and standardized
4. **Download Results**: Get clean CSV with comprehensive data quality report

## 📁 Project Structure

```
├── backend/
│   ├── enhanced_dexa_api.py      # Enhanced Flask API with comprehensive processing
│   ├── dexa_api.py               # Original API (legacy)
│   ├── datamang.py              # Data management utilities
│   └── requirements.txt          # Python dependencies
├── frontend/
│   ├── dexa-teal-upload.html     # Beautiful simplified interface
│   ├── dexa-advanced.html        # Full-featured interface
│   └── [other frontend files]
├── notebooks/
│   └── enhanced_dexa_processor.ipynb  # Research-grade analysis notebook
├── sample_data/
│   └── test_data_with_duplicates.csv  # Sample data for testing
└── README.md                     # This file
```

## 🎯 Data Processing Pipeline

### 1. **File Validation**
- Extension checking (.txt, .csv, .xlsx, .pdf, images)
- File size limits (50MB max)
- Format verification

### 2. **Smart Data Extraction**
- Automatic column mapping (subject_id, batch, timepoint, measurements)
- Multi-format parsing with fallback strategies
- Metadata preservation

### 3. **Comprehensive Cleaning**
- **Test Data Removal**: Advanced pattern detection for calibration/test records
- **Critical Field Validation**: Ensure subject_id, batch, timepoint completeness
- **Measurement Validation**: Range checking with biological plausibility
- **Statistical Outlier Detection**: IQR-based outlier identification
- **Duplicate Removal**: Intelligent duplicate detection across multiple columns

### 4. **Data Standardization**
- **Batch Naming**: `Batch_1`, `Batch_2`, etc.
- **Timepoint Mapping**: `Baseline`, `Week_1`, `Week_2`, `Post_Scan`
- **Subject ID Cleaning**: Remove invalid/placeholder IDs
- **Column Standardization**: Consistent naming and data types

### 5. **Quality Assessment**
- **Completeness Score**: Percentage of non-null values
- **Validity Score**: Data within expected ranges  
- **Consistency Score**: Standardization success rate
- **Overall Quality Score**: Weighted composite metric

## 🤝 Team Collaboration
This enhanced system provides a complete solution for DEXA data processing with both simplified and advanced interfaces for different user needs.

---

## Project History

### 09/21/2025 Meeting Notes
1. Andrew & Hans: data cleaning and imputation, Hans look into categorizing data based on column category
2. Rita & I: learn how to use Spanner for data mapping and then find an alternative to Notebook LLM to visualize mapped data
3. Push any and all work into a branch by Saturday noon
4. Setting a check in schedule with Patrick
5. Setting a subgroup weekly meeting scheduleumed
2025 WashU Med Application

# 09/21/2025
1. Andrew & Hans: data cleaning and imputation, Hans look into categorizing data based on column category
2. Rita & I: learn how to use Spanner for data mapping and then find an alternative to Notebook LLM to visualize mapped data
3. Push any and all work into a branch by Saturday noon
4. Setting a check in schedule with Patrick (@christien is it possible to add him to this slack Channel)
5. Setting a subgroup weekly meeting schedule- will address after this week (I’ll be present at both to make sure any potential problems get written up or questions get addressed)
