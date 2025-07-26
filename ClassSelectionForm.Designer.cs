namespace DnD3._5CharacterSheet
{
    partial class ClassSelectionForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            this.comboClassList = new System.Windows.Forms.ComboBox();
            this.txtClassName = new System.Windows.Forms.TextBox();
            this.txtSkills = new System.Windows.Forms.TextBox();
            this.txtHitDie = new System.Windows.Forms.TextBox();
            this.contextMenuStrip1 = new System.Windows.Forms.ContextMenuStrip(this.components);
            this.txtIsPrestige = new System.Windows.Forms.TextBox();
            this.txtSpellcasting = new System.Windows.Forms.TextBox();
            this.txtFeatures = new System.Windows.Forms.TextBox();
            this.contextMenuStrip2 = new System.Windows.Forms.ContextMenuStrip(this.components);
            this.button1 = new System.Windows.Forms.Button();
            this.txtAlignment = new System.Windows.Forms.TextBox();
            this.SuspendLayout();
            // 
            // comboClassList
            // 
            this.comboClassList.AccessibleName = "comboClassList";
            this.comboClassList.FormattingEnabled = true;
            this.comboClassList.Location = new System.Drawing.Point(12, 19);
            this.comboClassList.Name = "comboClassList";
            this.comboClassList.Size = new System.Drawing.Size(181, 21);
            this.comboClassList.TabIndex = 0;
            this.comboClassList.SelectedIndexChanged += new System.EventHandler(this.ComboClassList_SelectedIndexChanged);
            // 
            // txtClassName
            // 
            this.txtClassName.Location = new System.Drawing.Point(199, 20);
            this.txtClassName.Name = "txtClassName";
            this.txtClassName.ReadOnly = true;
            this.txtClassName.Size = new System.Drawing.Size(213, 20);
            this.txtClassName.TabIndex = 1;
            // 
            // txtSkills
            // 
            this.txtSkills.Location = new System.Drawing.Point(199, 46);
            this.txtSkills.Multiline = true;
            this.txtSkills.Name = "txtSkills";
            this.txtSkills.ReadOnly = true;
            this.txtSkills.ScrollBars = System.Windows.Forms.ScrollBars.Vertical;
            this.txtSkills.Size = new System.Drawing.Size(589, 150);
            this.txtSkills.TabIndex = 3;
            // 
            // txtHitDie
            // 
            this.txtHitDie.Location = new System.Drawing.Point(524, 20);
            this.txtHitDie.Name = "txtHitDie";
            this.txtHitDie.ReadOnly = true;
            this.txtHitDie.Size = new System.Drawing.Size(74, 20);
            this.txtHitDie.TabIndex = 4;
            // 
            // contextMenuStrip1
            // 
            this.contextMenuStrip1.Name = "contextMenuStrip1";
            this.contextMenuStrip1.Size = new System.Drawing.Size(61, 4);
            // 
            // txtIsPrestige
            // 
            this.txtIsPrestige.Location = new System.Drawing.Point(418, 20);
            this.txtIsPrestige.Name = "txtIsPrestige";
            this.txtIsPrestige.ReadOnly = true;
            this.txtIsPrestige.Size = new System.Drawing.Size(100, 20);
            this.txtIsPrestige.TabIndex = 7;
            // 
            // txtSpellcasting
            // 
            this.txtSpellcasting.Location = new System.Drawing.Point(604, 20);
            this.txtSpellcasting.Name = "txtSpellcasting";
            this.txtSpellcasting.ReadOnly = true;
            this.txtSpellcasting.Size = new System.Drawing.Size(184, 20);
            this.txtSpellcasting.TabIndex = 9;
            // 
            // txtFeatures
            // 
            this.txtFeatures.Location = new System.Drawing.Point(199, 202);
            this.txtFeatures.Multiline = true;
            this.txtFeatures.Name = "txtFeatures";
            this.txtFeatures.ReadOnly = true;
            this.txtFeatures.ScrollBars = System.Windows.Forms.ScrollBars.Vertical;
            this.txtFeatures.Size = new System.Drawing.Size(589, 236);
            this.txtFeatures.TabIndex = 11;
            // 
            // contextMenuStrip2
            // 
            this.contextMenuStrip2.Name = "contextMenuStrip2";
            this.contextMenuStrip2.Size = new System.Drawing.Size(61, 4);
            // 
            // button1
            // 
            this.button1.Location = new System.Drawing.Point(12, 415);
            this.button1.Name = "button1";
            this.button1.Size = new System.Drawing.Size(181, 23);
            this.button1.TabIndex = 13;
            this.button1.Text = "Select Class";
            this.button1.UseVisualStyleBackColor = true;
            this.button1.Click += new System.EventHandler(this.button1_Click);
            // 
            // txtAlignment
            // 
            this.txtAlignment.Location = new System.Drawing.Point(12, 46);
            this.txtAlignment.Multiline = true;
            this.txtAlignment.Name = "txtAlignment";
            this.txtAlignment.Size = new System.Drawing.Size(181, 150);
            this.txtAlignment.TabIndex = 14;
            // 
            // ClassSelectionForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(800, 450);
            this.Controls.Add(this.txtAlignment);
            this.Controls.Add(this.button1);
            this.Controls.Add(this.txtFeatures);
            this.Controls.Add(this.txtSpellcasting);
            this.Controls.Add(this.txtIsPrestige);
            this.Controls.Add(this.txtHitDie);
            this.Controls.Add(this.txtSkills);
            this.Controls.Add(this.txtClassName);
            this.Controls.Add(this.comboClassList);
            this.Name = "ClassSelectionForm";
            this.Text = "ClassSelectionForm";
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.ComboBox comboClassList;
        private System.Windows.Forms.TextBox txtClassName;
        private System.Windows.Forms.TextBox txtSkills;
        private System.Windows.Forms.TextBox txtHitDie;
        private System.Windows.Forms.ContextMenuStrip contextMenuStrip1;
        private System.Windows.Forms.TextBox txtIsPrestige;
        private System.Windows.Forms.TextBox txtSpellcasting;
        private System.Windows.Forms.TextBox txtFeatures;
        private System.Windows.Forms.ContextMenuStrip contextMenuStrip2;
        private System.Windows.Forms.Button button1;
        private System.Windows.Forms.TextBox txtAlignment;
    }
}