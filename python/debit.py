import sys
import re
import pdfplumber
import os

def extraire_debits(pdf_path):
    texte = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            texte += page.extract_text() + "\n"
    # Extraction des montants négatifs (débits)
    debits = [float(x.replace(',', '.')) for x in re.findall(r'-?\d+,\d{2}', texte) if '-' in x]
    return debits

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Glissez-déposez un fichier PDF sur ce script ou lancez-le avec le chemin du PDF en argument.")
        input("Appuyez sur Entrée pour quitter...")
        sys.exit(1)
    pdf_path = sys.argv[1]
    if not os.path.isfile(pdf_path) or not pdf_path.lower().endswith('.pdf'):
        print("Le fichier fourni n'est pas un PDF valide.")
        input("Appuyez sur Entrée pour quitter...")
        sys.exit(1)
    debits = extraire_debits(pdf_path)
    somme = sum(debits)
    print(f"Somme des débits : {somme:.2f} €")
    input("Appuyez sur Entrée pour quitter...")