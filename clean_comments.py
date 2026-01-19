#!/usr/bin/env python3
"""Script to remove comments from Python files while preserving docstrings."""
import os
import re
from pathlib import Path

def clean_python_file(filepath):
    """Remove inline comments from Python file, preserve docstrings."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    cleaned_lines = []
    in_docstring = False
    docstring_char = None
    
    for line in lines:
        stripped = line.lstrip()
        
        #Check for docstring markers
        if '"""' in stripped or "'''" in stripped:
            #Toggle docstring state
            if not in_docstring:
                if stripped.startswith('"""') or stripped.startswith("'''"):
                    in_docstring = True
                    docstring_char = stripped[:3]
                    cleaned_lines.append(line)
                    if stripped.count(docstring_char) >= 2:
                        in_docstring = False
                    continue
            else:
                cleaned_lines.append(line)
                if docstring_char in stripped[3:]:
                    in_docstring = False
                continue
        
        #If in docstring, keep the line
        if in_docstring:
            cleaned_lines.append(line)
            continue
        
        #Remove standalone comment lines
        if stripped.startswith('#'):
            continue
        
        #Remove inline comments but keep the code
        if '#' in line:
            #Find first # that's not in a string
            in_string = False
            quote_char = None
            for i, char in enumerate(line):
                if char in ('"', "'") and (i == 0 or line[i-1] != '\\'):
                    if not in_string:
                        in_string = True
                        quote_char = char
                    elif char == quote_char:
                        in_string = False
                        quote_char = None
                elif char == '#' and not in_string:
                    line = line[:i].rstrip() + '\n'
                    break
        
        cleaned_lines.append(line)
    
    #Remove consecutive blank lines
    final_lines = []
    prev_blank = False
    for line in cleaned_lines:
        is_blank = line.strip() == ''
        if is_blank and prev_blank:
            continue
        final_lines.append(line)
        prev_blank = is_blank
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(final_lines)
    
    print(f"Cleaned: {filepath}")

def main():
    backend_dir = Path(__file__).parent / 'backend'
    
    #Find all Python files
    for py_file in backend_dir.rglob('*.py'):
        #Skip __pycache__ and venv
        if '__pycache__' in str(py_file) or 'venv' in str(py_file):
            continue
        clean_python_file(py_file)
    
    print("Done cleaning Python files!")

if __name__ == "__main__":
    main()
