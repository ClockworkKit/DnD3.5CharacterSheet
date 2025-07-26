using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace DnD3._5CharacterSheet
{
    public partial class Form1 : Form
    {
        private Dictionary<string, TextBox> abilityModFields = new Dictionary<string, TextBox>();
        private int level1IntMod = 0;
        private int classSkillPoints = 0;
        private TextBox txtCharacterClass;
        private TextBox txtSkillPointsRemaining;
        private bool classSelected = false;
        private int characterLevel = 1;
        private Label lblLevelDisplay;
        private Dictionary<int, int> maxRanksPerSkill = new Dictionary<int, int>();
        private HashSet<string> globalClassSkills = new HashSet<string>();
        private static readonly string[] allSkills = 
        {
            "Appraise", "Balance", "Bluff", "Climb", "Concentration", "Craft",
            "Decipher Script", "Diplomacy", "Disable Device", "Disguise",
            "Escape Artist", "Forgery", "Gather Information", "Handle Animal",
            "Heal", "Hide", "Intimidate", "Jump", "Knowledge (arcana)",
            "Knowledge (architecture and engineering)", "Knowledge (dungeoneering)",
            "Knowledge (geography)", "Knowledge (history)", "Knowledge (local)",
            "Knowledge (nature)", "Knowledge (nobility and royalty)", "Knowledge (psionics)",
            "Knowledge (religion)", "Knowledge (the planes)", "Listen", "Move Silently",
            "Open Lock", "Perform", "Profession", "Ride", "Search", "Sense Motive",
            "Sleight of Hand", "Spellcraft", "Spot", "Survival", "Swim", "Tumble",
            "Use Magic Device", "Use Rope"
        };



        public Form1()
        {
            InitializeComponent();

            txtCharacterClass = new TextBox
            {
                Name = "txtCharacterClass",
                Location = new Point(86, 78),
                BorderStyle = BorderStyle.None,
                BackColor = Color.White,
                Size = new Size(150, 20),
                ReadOnly = true
            };
            panel1.Controls.Add(txtCharacterClass);
            txtCharacterClass.BringToFront();

            txtSkillPointsRemaining = new TextBox
            {
                Name = "txtSkillPointsRemaining",
                Location = new Point(800, 200),
                Size = new Size(50, 20),
                ReadOnly = true,
                BackColor = Color.White,
                BorderStyle = BorderStyle.None,
                TextAlign = HorizontalAlignment.Center
            };
            panel1.Controls.Add(txtSkillPointsRemaining);
            txtSkillPointsRemaining.BringToFront();

            // Level Display
            lblLevelDisplay = new Label
            {
                Location = new Point(620, 80),
                Size = new Size(100, 20),
                Text = $"Level: {characterLevel}"
            };
            panel1.Controls.Add(lblLevelDisplay);
            lblLevelDisplay.BringToFront();

            // Level Up Button
            Button btnLevelUp = new Button
            {
                Text = "+",
                Location = new Point(670, 80),
                Size = new Size(25, 20)
            };
            btnLevelUp.Click += (s, e) => ChangeLevel(1);
            panel1.Controls.Add(btnLevelUp);
            btnLevelUp.BringToFront();

            // Level Down Button
            Button btnLevelDown = new Button
            {
                Text = "-",
                Location = new Point(700, 80),
                Size = new Size(25, 20)
            };
            btnLevelDown.Click += (s, e) => ChangeLevel(-1);
            panel1.Controls.Add(btnLevelDown);
            btnLevelDown.BringToFront();

        }

        private void ChangeLevel(int delta)
        {
            characterLevel = Math.Max(1, characterLevel + delta);
            lblLevelDisplay.Text = $"Level: {characterLevel}";
            UpdateMaxSkillRanks();
        }

        private void UpdateMaxSkillRanks()
        {
            maxRanksPerSkill.Clear();
            int level = characterLevel;
            int classMax = level + 3;
            int crossMax = (level + 3) / 2;

            for (int i = 0; i < allSkills.Length; i++)
            {
                string skill = allSkills[i];
                if (globalClassSkills.Contains(skill))
                    maxRanksPerSkill[i] = classMax;
                else
                    maxRanksPerSkill[i] = crossMax;
            }
            Console.WriteLine("=== Max Rank Table ===");
            for (int i = 0; i < allSkills.Length; i++)
            {
                Console.WriteLine($"{allSkills[i]}: {maxRanksPerSkill[i]} ({(globalClassSkills.Contains(allSkills[i]) ? "Class" : "Cross-Class")})");
            }
        }
        private void LoadCharacterSheetPages()
        {
            string[] pageFiles = { "0001.png", "0002.png", "0003.png", "0004.png" };
            int yOffset = 0;

            foreach (string file in pageFiles)
            {
                PictureBox pic = new PictureBox
                {
                    Image = Image.FromFile(Path.Combine(Application.StartupPath, "Assets", file)),
                    SizeMode = PictureBoxSizeMode.AutoSize,
                    Location = new Point(0, yOffset),
                };
                panel1.Controls.Add(pic);
                yOffset += pic.Height;
            }
        }

        private void CreateStatBlock()
        {
            string[] abilities = { "STR", "DEX", "CON", "INT", "WIS", "CHA" };
            int baseX = 192;
            int modX = 238;
            int startY = 262;
            int rowSpacing = 26;

            for (int i = 0; i < abilities.Length; i++)
            {
                int y = startY + i * rowSpacing;
                string ability = abilities[i];

                TextBox txtBase = new TextBox
                {
                    Name = "txt" + ability + "Base",
                    Location = new Point(baseX, y),
                    Width = 38,
                    BorderStyle = BorderStyle.None,
                    BackColor = Color.White,
                    ForeColor = Color.Black,
                    Font = new Font("Segoe UI", 9, FontStyle.Regular),
                    TextAlign = HorizontalAlignment.Center
                };
                panel1.Controls.Add(txtBase);
                txtBase.BringToFront();

                TextBox txtMod = new TextBox
                {
                    Name = "txt" + ability + "Mod",
                    Location = new Point(modX, y),
                    Width = 38,
                    ReadOnly = true,
                    BorderStyle = BorderStyle.None,
                    BackColor = Color.White,
                    ForeColor = Color.Black,
                    Font = new Font("Segoe UI", 9, FontStyle.Regular),
                    TabStop = false,
                    TextAlign = HorizontalAlignment.Center
                };
                panel1.Controls.Add(txtMod);
                txtMod.BringToFront();

                abilityModFields[ability] = txtMod;

                txtBase.TextChanged += (s, e) =>
                {
                    if (int.TryParse(txtBase.Text, out int score))
                    {
                        int mod = (score - 10) / 2;
                        txtMod.Text = mod.ToString("+0;-0;0");

                        if (ability == "INT" && !classSelected)
                            UpdateRemainingSkillPoints();
                    }
                    else
                    {
                        txtMod.Text = "";

                        if (ability == "INT" && !classSelected)
                            UpdateRemainingSkillPoints();
                    }
                };
            }
        }

        private void CreateModifierOutputs()
        {
            TextBox MakeOutputBox(int x, int y, string ability)
            {
                TextBox box = new TextBox
                {
                    Width = 30,
                    Location = new Point(x, y),
                    ReadOnly = true,
                    BorderStyle = BorderStyle.None,
                    BackColor = Color.White,
                    TextAlign = HorizontalAlignment.Center
                };
                panel1.Controls.Add(box);
                box.BringToFront();

                if (abilityModFields.ContainsKey(ability))
                {
                    abilityModFields[ability].TextChanged += (s, e) =>
                    {
                        box.Text = abilityModFields[ability].Text;
                    };
                }

                return box;
            }

            MakeOutputBox(295, 504, "DEX");
            MakeOutputBox(588, 707, "DEX");

            MakeOutputBox(369, 707, "CON"); // Fort
            MakeOutputBox(369, 734, "DEX"); // Ref
            MakeOutputBox(369, 762, "WIS"); // Will

            MakeOutputBox(548, 860, "STR");
            MakeOutputBox(548, 887, "DEX");
            MakeOutputBox(548, 914, "STR");
            MakeOutputBox(548, 946, "STR");
        }

        private void CreateSkillModifierFields(Dictionary<string, TextBox> modFields)
        {
            string[] modOrder = {
        "INT", "DEX", "CHA", "STR", "CON", "INT", "INT", "CHA", "INT", "CHA",
        "DEX", "INT", "CHA", "CHA", "WIS", "DEX", "CHA", "STR", "INT", "INT",
        "INT", "INT", "WIS", "DEX", "DEX", "CHA", "CHA", "CHA", "WIS", "DEX",
        "INT", "WIS", "DEX", "INT", "WIS", "WIS", "STR", "DEX", "CHA", "DEX"
    };

            int startX = 1013;
            float startY = 232f;
            float spacingY = 22.45f;
            int fieldWidth = 29;
            int fieldHeight = 20;

            for (int i = 0; i < modOrder.Length; i++)
            {
                string ability = modOrder[i];
                int y = (int)Math.Round(startY + i * spacingY);

                if (!modFields.TryGetValue(ability, out TextBox linkedMod)) continue;

                // Modifier box (ability modifier only)
                TextBox txtMod = new TextBox
                {
                    Name = $"txtSkillMod{i}",
                    Location = new Point(startX, y),
                    Width = fieldWidth,
                    Height = fieldHeight,
                    ReadOnly = true,
                    Multiline = true,
                    TextAlign = HorizontalAlignment.Center,
                    BorderStyle = BorderStyle.None,
                    BackColor = Color.White
                };

                // Rank box (editable)
                TextBox txtRank = new TextBox
                {
                    Name = $"txtSkillRank{i}",
                    Location = new Point(startX + 33, y),
                    Width = fieldWidth,
                    Height = fieldHeight,
                    Multiline = true,
                    TextAlign = HorizontalAlignment.Center,
                    BorderStyle = BorderStyle.None,
                    BackColor = Color.White
                };

                // Total box (mod + rank)
                TextBox txtTotal = new TextBox
                {
                    Name = $"txtSkillTotal{i}",
                    Location = new Point(startX - 33, y),
                    Width = fieldWidth,
                    Height = fieldHeight,
                    Multiline = true,
                    ReadOnly = true,
                    TextAlign = HorizontalAlignment.Center,
                    BorderStyle = BorderStyle.None,
                    BackColor = Color.White
                };

                void UpdateTotal()
                {
                    int mod = int.TryParse(linkedMod.Text, out var m) ? m : 0;
                    int rank = int.TryParse(txtRank.Text, out var r) ? r : 0;
                    txtTotal.Text = (mod + rank).ToString("+0;-0;0");
                }

                linkedMod.TextChanged += (s, e) =>
                {
                    txtMod.Text = linkedMod.Text;
                    UpdateTotal();
                };

                txtRank.TextChanged += (s, e) =>
                {
                    int rank = int.TryParse(txtRank.Text, out var r) ? r : 0;
                    int mod = int.TryParse(linkedMod.Text, out var m) ? m : 0;
                    if (maxRanksPerSkill.TryGetValue(i, out int maxRank) && rank > maxRank)
                    {
                        rank = maxRank;
                        txtRank.Text = maxRank.ToString(); // enforce cap
                    }
                    txtTotal.Text = (rank + mod).ToString("+0;-0;0");
                    UpdateRemainingSkillPoints();
                };
                txtMod.Text = linkedMod.Text;
                UpdateTotal();

                panel1.Controls.Add(txtMod);
                panel1.Controls.Add(txtRank);
                panel1.Controls.Add(txtTotal);
                txtMod.BringToFront();
                txtRank.BringToFront();
                txtTotal.BringToFront();
            }
        }
        private void CreateBasicInfoFields()
        {
            var fieldSpecs = new[]
            {
                new { Label = "Name",       X = 128, Y = 50, Width = 400 },
                new { Label = "Player",     X = 629, Y = 50, Width = 220 },
                new { Label = "Alignment",  X = 661, Y = 104, Width = 100 },
                new { Label = "Deity",      X = 214, Y = 132, Width = 620 },
                new { Label = "Residence",  X = 549, Y = 157, Width = 180 },
            };

            int fieldHeight = 22;

            foreach (var spec in fieldSpecs)
            {
                TextBox txtField = new TextBox
                {
                    Name = $"txt{spec.Label}",
                    Location = new Point(spec.X, spec.Y),
                    Width = spec.Width,
                    Height = fieldHeight,
                    BorderStyle = BorderStyle.None,
                    BackColor = Color.White,
                    TextAlign = HorizontalAlignment.Left,
                    Font = new Font("Segoe UI", 9, FontStyle.Regular)
                };

                panel1.Controls.Add(txtField);
                txtField.BringToFront();
            }
        }

        private void ApplyClassSkills(List<string> classSkills)
        {
            globalClassSkills = new HashSet<string>(classSkills, StringComparer.OrdinalIgnoreCase);

            foreach (Control control in panel1.Controls)
            {
                if (control is TextBox textBox && textBox.Name.StartsWith("txtSkillMod"))
                {
                    string numPart = new string(textBox.Name.Where(char.IsDigit).ToArray());
                    if (int.TryParse(numPart, out int skillIndex) && skillIndex < allSkills.Length)
                    {
                        string skillName = allSkills[skillIndex];
                        bool isClassSkill = globalClassSkills.Contains(skillName);

                        textBox.BackColor = isClassSkill ? Color.LightYellow : Color.White;
                        textBox.Font = new Font(textBox.Font, isClassSkill ? FontStyle.Bold : FontStyle.Regular);
                    }
                }
            }
        }
    

    private void UpdateRemainingSkillPoints()
        {
            int intMod = classSelected ? level1IntMod : GetAbilityModifier("INT");
            int level1Points = Math.Max((classSkillPoints + intMod), 1) * 4;
            int usedPoints = CountUsedSkillPoints();
            int remaining = level1Points - usedPoints;

            txtSkillPointsRemaining.Text = remaining.ToString();
            txtSkillPointsRemaining.ForeColor = (remaining < 0) ? Color.Red : Color.Black;
            txtSkillPointsRemaining.BringToFront(); // Ensure it's visible
        }
        private int CountUsedSkillPoints()
        {
            int total = 0;
            foreach (Control control in panel1.Controls)
            {
                if (control is TextBox tb && tb.Name.StartsWith("txtSkillRank"))
                {
                    if (int.TryParse(tb.Text, out int value))
                        total += value;
                }
            }
            return total;
        }
        private int GetAbilityModifier(string ability)
        {
            if (abilityModFields.TryGetValue(ability.ToUpper(), out TextBox modBox))
            {
                if (int.TryParse(modBox.Text, out int mod))
                    return mod;
            }
            return 0;
        }
        private void EnforceSkillRankCaps()
        {
            for (int i = 0; i < allSkills.Length; i++)
            {
                TextBox rankBox = panel1.Controls
                    .OfType<TextBox>()
                    .FirstOrDefault(tb => tb.Name == $"txtSkillRank{i}");

                if (rankBox != null && int.TryParse(rankBox.Text, out int current))
                {
                    if (maxRanksPerSkill.TryGetValue(i, out int max) && current > max)
                    {
                        rankBox.Text = max.ToString();
                    }
                }
            }
        }

        private void Form1_Load(object sender, EventArgs e)
        {
            LoadCharacterSheetPages();
            CreateStatBlock();
            CreateModifierOutputs();
            CreateSkillModifierFields(abilityModFields);
            CreateBasicInfoFields();
        }

        private void button1_Click(object sender, EventArgs e)
        {
            using (ClassSelectionForm classForm = new ClassSelectionForm())
            {
                if (classForm.ShowDialog() == DialogResult.OK && !string.IsNullOrEmpty(classForm.SelectedClassName))
                {
                    txtCharacterClass.Text = classForm.SelectedClassName;

                    classSelected = true;
                    classSkillPoints = classForm.SelectedSkillPoints;

                    // Set level 1 INT modifier
                    TextBox txtINTBase = panel1.Controls
                        .OfType<TextBox>()
                        .FirstOrDefault(tb => tb.Name == "txtINTBase");

                    if (txtINTBase != null && int.TryParse(txtINTBase.Text, out int intScore))
                        level1IntMod = (intScore - 10) / 2;
                    else
                        level1IntMod = 0;

                    // Cache class skills globally FIRST
                    globalClassSkills = new HashSet<string>(classForm.SelectedClassSkills, StringComparer.OrdinalIgnoreCase);

                    // Then calculate max ranks
                    UpdateMaxSkillRanks();

                    // THEN apply skill UI (this highlights and refreshes colors etc.)
                    ApplyClassSkills(classForm.SelectedClassSkills);

                    // Finally update remaining points
                    UpdateRemainingSkillPoints();
                    EnforceSkillRankCaps();
                }
            }
        }
    }
}