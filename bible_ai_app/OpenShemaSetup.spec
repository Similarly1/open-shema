# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['installer/installer_main.py'],
    pathex=['installer'],
    binaries=[],
    datas=[('installer/web', 'web'), ('assets', 'assets')],
    hiddenimports=['installer_api', 'win32com', 'win32com.client', 'webview'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', '_tkinter', 'tcl', 'tk', 'unittest', 'sqlite3', '_sqlite3', 'cryptography', 'bcrypt', 'xmlrpc', 'setuptools', 'pip', 'jinja2', 'difflib', 'pydoc', 'doctest'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='OpenShemaSetup',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['assets/icon.ico'],
)
