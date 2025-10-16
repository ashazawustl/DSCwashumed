import pandas as pd
import re
from scipy import stats
import numpy as np

# Dataset
df = pd.read_csv("data/Review_SY-08002944_4_3_2025 10_31_21.csv")

#Need to clean Neutrophils column. Use regex to remove non-numeric characters and convert to float.
def clean_column(x):
    if isinstance(x, str):
        x = re.sub(r"[^0-9.]", "", x)
        return float(x) if x else np.nan
    return np.nan

df["Neutrophils"] = df["Neu # (10^3/uL)"].apply(clean_column)
df = df.dropna(subset=["Neutrophils"])

# Identify categorical columns with at least two unique values
applicable_columns = [c for c in df.columns if df[c].dtype == "object" and df[c].nunique() >= 2]
candidate = None
for c in applicable_columns:
    if df[c].nunique() == 2:
        candidate = c
        break

print(candidate)
choice = candidate


df = df.dropna(subset=[choice])
groups = [vals["Neutrophils"].values for _, vals in df.groupby(choice)]

if len(groups) < 2:
    raise ValueError("Cannot find a Group to run ANOVA on.")

f_stat, p_value = stats.f_oneway(*groups)
df_between = len(groups) - 1
df_within = len(df) - len(groups)

print(f"ANOVA for Neutrophils across '{choice}'")
print(f"F-statistic: {f_stat:.4f}")
print(f"p-value: {p_value:.6f}")
print("Observations:", len(df))
print(f"Degrees of freedom: between = {df_between}, within = {df_within}")
