import subprocess
import os
import base64

def askopenfilename(title="Ouvrir", filetypes=None):
    """Ouvre une boite de dialogue de sélection de fichier via un processus PowerShell séparé avec encodage Base64 UTF-8."""
    filters = []
    if filetypes:
        for name, ext in filetypes:
            ext_ps = ext.replace(" ", ";")
            if "(" in name:
                filters.append(f"{name}|{ext_ps}")
            else:
                filters.append(f"{name} ({ext})|{ext_ps}")
    filter_str = "|".join(filters) if filters else "Tous les fichiers (*.*)|*.*"
    
    ps_script = f'''
    Add-Type -AssemblyName System.Windows.Forms
    $f = New-Object System.Windows.Forms.OpenFileDialog
    $f.Title = "{title}"
    $f.Filter = "{filter_str}"
    if ($f.ShowDialog() -eq 'OK') {{
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($f.FileName)
        [System.Convert]::ToBase64String($bytes)
    }}
    '''
    CREATE_NO_WINDOW = 0x08000000
    try:
        result = subprocess.run(
            ['powershell', '-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps_script], 
            capture_output=True, text=True, creationflags=CREATE_NO_WINDOW
        )
        res = result.stdout.strip()
        if res:
            return base64.b64decode(res).decode('utf-8')
    except Exception:
        pass
        
    # Fallback tkinter
    try:
        from tkinter import filedialog as tk_filedialog
        return tk_filedialog.askopenfilename(title=title, filetypes=filetypes or [("Tous les fichiers", "*.*")])
    except Exception:
        return ""

def asksaveasfilename(title="Enregistrer sous", defaultextension="", filetypes=None, initialfile=""):
    """Ouvre une boite de dialogue de sauvegarde de fichier via un processus PowerShell séparé avec encodage Base64 UTF-8."""
    filters = []
    if filetypes:
        for name, ext in filetypes:
            ext_ps = ext.replace(" ", ";")
            filters.append(f"{name} ({ext})|{ext_ps}")
    filter_str = "|".join(filters) if filters else "Tous les fichiers (*.*)|*.*"
    
    # Échapper les backslashes pour PowerShell
    safe_initialfile = (initialfile or "").replace("\\", "\\\\")

    ps_script = f'''
    Add-Type -AssemblyName System.Windows.Forms
    $f = New-Object System.Windows.Forms.SaveFileDialog
    $f.Title = "{title}"
    $f.Filter = "{filter_str}"
    $f.DefaultExt = "{defaultextension.lstrip('.')}"
    $f.FileName = "{safe_initialfile}"
    $f.TopMost = $true
    if ($f.ShowDialog() -eq 'OK') {{
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($f.FileName)
        [System.Convert]::ToBase64String($bytes)
    }}
    '''
    CREATE_NO_WINDOW = 0x08000000
    try:
        result = subprocess.run(
            ['powershell', '-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps_script], 
            capture_output=True, text=True, creationflags=CREATE_NO_WINDOW
        )
        res = result.stdout.strip()
        if res:
            return base64.b64decode(res).decode('utf-8')
    except Exception:
        pass
        
    # Fallback tkinter
    try:
        from tkinter import filedialog as tk_filedialog
        return tk_filedialog.asksaveasfilename(
            title=title,
            defaultextension=defaultextension,
            initialfile=initialfile,
            filetypes=filetypes or [("Tous les fichiers", "*.*")]
        )
    except Exception:
        return ""
def askdirectory(title="Sélectionner un dossier"):
    """Ouvre une boite de dialogue de sélection de dossier via PowerShell avec encodage Base64 UTF-8 ou fallback tkinter."""
    ps_script = f'''
    Add-Type -AssemblyName System.Windows.Forms
    $f = New-Object System.Windows.Forms.FolderBrowserDialog
    $f.Description = "{title}"
    $f.ShowNewFolderButton = $true
    if ($f.ShowDialog() -eq 'OK') {{
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($f.SelectedPath)
        [System.Convert]::ToBase64String($bytes)
    }}
    '''
    CREATE_NO_WINDOW = 0x08000000
    try:
        result = subprocess.run(
            ['powershell', '-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps_script], 
            capture_output=True, text=True, creationflags=CREATE_NO_WINDOW
        )
        res = result.stdout.strip()
        if res:
            return base64.b64decode(res).decode('utf-8')
    except Exception:
        pass
        
    # Fallback tkinter
    try:
        from tkinter import filedialog as tk_filedialog
        return tk_filedialog.askdirectory(title=title)
    except Exception:
        return ""
