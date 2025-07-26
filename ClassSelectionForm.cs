using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using Newtonsoft.Json;


namespace DnD3._5CharacterSheet
{
    public partial class ClassSelectionForm : Form
    {
        private SQLiteConnection dbConnection;
        public string SelectedClassName { get; private set; }
        public int SelectedSkillPoints { get; private set; }

        public ClassSelectionForm()
        {
            InitializeComponent();
            this.Load += new EventHandler(ClassSelectionForm_Load);

        }

        private void ClassSelectionForm_Load(object sender, EventArgs e)
        {
            string dbPath = Path.Combine(Application.StartupPath, "Assets", "Databases", "class_data.sqlite");
            dbConnection = new SQLiteConnection($"Data Source={dbPath};Version=3;");
            dbConnection.Open();

            using (var cmd = new SQLiteCommand("SELECT name FROM classes ORDER BY name ASC", dbConnection))
            using (var reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    comboClassList.Items.Add(reader.GetString(0));
                }
            }
        }
        private string FormatList(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "None";

            try
            {
                // Try parsing it as a JSON list
                var list = JsonConvert.DeserializeObject<List<string>>(raw);
                if (list != null && list.Count > 0)
                {
                    return string.Join(Environment.NewLine, list
                        .Select(item => item.Trim().TrimStart('-', '•', '*', '.', ':')));
                }
            }
            catch
            {
                // Fallback: just do a raw string cleanup
                string[] items = raw.Split(new[] { ',', ';', '|', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                var cleaned = items
                    .Select(item => item.Trim().TrimStart('-', '•', '*', '.', ':'))
                    .Where(item => !string.IsNullOrWhiteSpace(item));
                return string.Join(Environment.NewLine, cleaned);
            }

            return "None";
        }
        public static string DetectSpellcastingType(List<string> features)
        {
            if (features == null || features.Count == 0)
                return "none";

            string[] arcane = { "arcane", "wizard", "sorcerer", "spellbook" };
            string[] divine = { "divine", "cleric", "druid", "turn undead" };
            string[] psionic = { "psionic", "power point", "psion", "wilder" };
            string[] pact = { "invocation", "eldritch", "warlock" };
            string[] truenamer = { "truespeak", "utterance", "truename" };
            string[] shadow = { "mystery", "shadowcaster" };

            string lowerConcat = string.Join(" ", features).ToLower();

            if (arcane.Any(k => lowerConcat.Contains(k)))
                return "arcane";
            if (divine.Any(k => lowerConcat.Contains(k)))
                return "divine";
            if (psionic.Any(k => lowerConcat.Contains(k)))
                return "psionic";
            if (pact.Any(k => lowerConcat.Contains(k)))
                return "pact";
            if (truenamer.Any(k => lowerConcat.Contains(k)))
                return "truenamer";
            if (shadow.Any(k => lowerConcat.Contains(k)))
                return "shadow";

            return "none";
        }
        public List<string> SelectedClassSkills { get; private set; } = new List<string>();

        private void ComboClassList_SelectedIndexChanged(object sender, EventArgs e)
        {
            string selectedClass = comboClassList.SelectedItem.ToString();
            string query = "SELECT * FROM classes WHERE name = @name";

            using (var cmd = new SQLiteCommand(query, dbConnection))
            {
                cmd.Parameters.AddWithValue("@name", selectedClass);

                using (var reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        txtClassName.Text = reader["name"]?.ToString()?.Trim();
                        txtHitDie.Text = reader["hit_die"]?.ToString()?.Trim();
                        txtAlignment.Text = reader["alignment"]?.ToString()?.Trim();
                        txtSkills.Text = FormatList(reader["skills"]?.ToString());
                        txtFeatures.Text = FormatList(reader["features"]?.ToString());
                        string featuresRaw = reader["features"]?.ToString();
                        txtFeatures.Text = FormatList(featuresRaw);
                        string skillsRaw = reader["skills"]?.ToString();
                        object skillPointsObj = reader["skill_points"];
                        if (skillPointsObj != DBNull.Value)
                            SelectedSkillPoints = Convert.ToInt32(skillPointsObj);
                        else
                            SelectedSkillPoints = 0;


                        try
                        {
                            SelectedClassSkills = JsonConvert.DeserializeObject<List<string>>(skillsRaw) ?? new List<string>();
                        }
                        catch
                        {
                            SelectedClassSkills = new List<string>();
                        }


                        List<string> featureList;
                        try
                        {
                            featureList = JsonConvert.DeserializeObject<List<string>>(featuresRaw) ?? new List<string>();
                        }
                        catch
                        {
                            featureList = new List<string>();
                        }

                        string casterType = DetectSpellcastingType(featureList);

                        if (casterType != "none")
                        {
                            txtSpellcasting.Text = $"Spellcasting: {char.ToUpper(casterType[0]) + casterType.Substring(1)}";
                        }
                        else
                        {
                            txtSpellcasting.Text = "None";
                        }
                        object prestigeObj = reader["is_prestige"];
                        if (prestigeObj != DBNull.Value)
                        {
                            int prestigeVal = Convert.ToInt32(prestigeObj);
                            txtIsPrestige.Text = (prestigeVal == 0) ? "Yes" : "No";
                        }
                        else
                        {
                            txtIsPrestige.Text = "Unknown";
                        }
                    }
                }
            }
        }

        private void button1_Click(object sender, EventArgs e)
        {
            if (comboClassList.SelectedItem != null)
            {
                SelectedClassName = comboClassList.SelectedItem.ToString();
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            else
            {
                MessageBox.Show("Please select a class before confirming.");
            }

        }
    }
}
