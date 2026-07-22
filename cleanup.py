import re

with open("src/main.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
skip_until = -1

for i, line in enumerate(lines):
    if i <= skip_until:
        continue

    # Skip simple single line imports and declarations
    if re.search(r"import.*(fog_reveal|grow_fall|frost_reveal|vortex)\.js", line): continue
    if re.search(r"let (fogReveal|growFall|frostReveal|gravityVortex) = null;", line): continue
    if re.search(r"let (dynamicVortex|vortexPreset|fogPreset|frostPreset|growfallPreset).*;", line): continue
    if re.search(r"(fogPresetGroup|frostPresetGroup|growfallPresetGroup|vortexPresetGroup) = document\.getElementById", line): continue
    if re.search(r"(fogPresetSelect|frostPresetSelect|growfallPresetSelect|vortexPresetSelect) = document\.getElementById", line): continue
    
    # Remove from effectsList arrays
    if "const effectsList =" in line or "const effects =" in line:
        line = re.sub(r"'frost',?\s*|'fog',?\s*|'growfall',?\s*|'vortex',?\s*", "", line)
        line = line.replace(", ]", "]").replace(",]", "]")
    
    # Remove playlist items
    if re.search(r"\{ name: '(fog|frost|growfall|vortex)',", line): continue
    
    # Switch cases
    if re.search(r"case '(fog|frost|growfall|vortex)':", line):
        skip_until = i + 6
        continue
        
    # Safe listeners
    if re.search(r"safeAddListener\((fog|frost|growfall|vortex)PresetSelect", line):
        skip_until = i + 3
        continue
        
    # Object definitions
    if re.search(r"^\s*(fog|frost|growfall|vortex): \{\s*$", line):
        skip_until = i + 5
        continue
        
    # JSON data load/save
    if re.search(r"if \(data\.(fog|frost|growfall|vortex)Preset", line):
        skip_until = i + 2
        continue
    if re.search(r"(fog|frost|growfall|vortex)Preset: (fog|frost|growfall|vortex)PresetSelect", line): continue
    if "dynamicVortex" in line and ("!== undefined" in line or ":" in line or "," in line):
        if "if (data.dynamicVortex" in line:
            skip_until = i + 2
            continue
        if "," in line and not ":" in line: # e.g. dynamicVortexGravity,
            continue
    
    # display toggles
    if re.search(r"if \((fog|frost|growfall|vortex)PresetGroup\)", line):
        skip_until = i + 1
        continue
    
    # init calls
    if re.search(r"\} else if \(activeEffect === '(fog|frost|growfall|vortex)'\)", line):
        skip_until = i + 1
        continue
        
    # Change effect transitions
    if re.search(r"changeEffectWithTransition\('(fog|frost|growfall|vortex)'\)", line):
        skip_until = i + 1
        continue
        
    # Special UI blocks for vortex
    if "} else if (activeEffect === 'vortex') {" in line:
        skip_until = i + 38
        continue

    new_lines.append(line)

with open("src/main.js", "w", encoding="utf-8") as f:
    f.writelines(new_lines)
