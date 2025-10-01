import tkinter as tk
from tkinter import filedialog, messagebox
import pdfplumber
import re


# Fonction d'extraction des débits
def extraire_debits_texte(texte):
    # On ne prend que les lignes du type : 11.06 11.06.25 9,00
    pattern = re.compile(r"\d{2}\.\d{2}\s+\d{2}\.\d{2}\.\d{2}\s+([\d\s]+,\d{2})")
    debits = []
    for match in pattern.finditer(texte):
        montant_str = match.group(1).replace(' ', '').replace(',', '.')
        try:
            montant = float(montant_str)
            debits.append(montant)
        except ValueError:
            continue
    return debits


def extraire_debits(pdf_path):
    debits = []
    credits = []
    started = False
    arreter = False
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            if arreter:
                break
            texte = page.extract_text()
            if not texte:
                continue
            lignes = texte.splitlines()
            for ligne in lignes:
                l_upper = ligne.upper()
                if not started and "DATE LIBELLE VALEUR DEBIT CREDIT" in l_upper:
                    started = True
                    continue
                if not started:
                    continue
                if "INFORMATION PREALABLE" in l_upper or "SOLDE EN EUROS" in l_upper:
                    arreter = True
                    break
                # Extraire tous les montants de la ligne
                montants = re.findall(r"\d+,\d{2}", ligne)
                debit = None
                credit = None
                if len(montants) == 1:
                    # On ne sait pas si c'est débit ou crédit, on met dans débit
                    debit = float(montants[0].replace(',', '.'))
                elif len(montants) >= 2:
                    debit = float(montants[0].replace(',', '.'))
                    credit = float(montants[1].replace(',', '.'))
                debits.append(debit)
                credits.append(credit)
                print(f"[DEBUG] Ligne : {ligne}")
                print(f"[DEBUG] Débit : {debit} | Crédit : {credit}")
    print("Débits extraits :", debits)
    print("Crédits extraits :", credits)
    return debits, credits

def choisir_fichier():
    chemin = filedialog.askopenfilename(
        title="Sélectionner un relevé PDF",
        filetypes=[("Fichiers PDF", "*.pdf")]
    )
    if not chemin:
        return
    try:
        debits, credits = extraire_debits(chemin)
        somme_debits = sum([d for d in debits if d is not None])
        somme_credits = sum([c for c in credits if c is not None])
        result_var.set(f"Débits : {somme_debits:.2f} € | Crédits : {somme_credits:.2f} €")
    except Exception as e:
        messagebox.showerror("Erreur", f"Erreur lors de l'analyse : {e}")



# Interface Tkinter
root = tk.Tk()
root.title("Calculateur de débits PDF")
root.geometry("350x180")
root.resizable(False, False)


frame = tk.Frame(root, padx=20, pady=10)
frame.pack(expand=True, fill="both")

label = tk.Label(frame, text="Sélectionnez un relevé PDF à analyser :", font=("Arial", 11))
label.pack(pady=(0, 5))


btn = tk.Button(frame, text="Somme des débits", command=choisir_fichier, font=("Arial", 11, "bold"), bg="#30345d", fg="white")
btn.pack(pady=(0, 10))



result_var = tk.StringVar()
result_label = tk.Label(frame, textvariable=result_var, font=("Arial", 12, "bold"), fg="#30345d")
result_label.pack(pady=(10, 0))

root.mainloop()
