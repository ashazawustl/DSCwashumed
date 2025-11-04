import papermill as pm
from pathlib import Path
# --- Paths ---
notebook_path = Path("/Users/shazaali/Desktop/DSCwashumed/backend/Pearson_Spearman.ipynb")
output_notebook = Path("/Users/shazaali/Desktop/DSCwashumed/backend/results/Pearson_Spearman_output.ipynb")

# --- User-selected dataset path (the one you want to analyze) ---
data_file = Path("/Users/shazaali/Desktop/DSCwashumed/backend/data/cleadned_data/Review_SY-08002944_cleaned.xlsx")

# --- Optional: parameters to pass into notebook ---
params = {
    "DATA_PATH": str(data_file),
    # Add others later, e.g. 'SAMPLE_SELECTION': selected_samples
}

# --- Run the notebook ---
pm.execute_notebook(
    input_path=str(notebook_path),
    output_path=str(output_notebook),
    parameters=params,
    progress_bar=False,
    log_output=True
)

print(f"Notebook executed successfully. Output saved to {output_notebook}")
