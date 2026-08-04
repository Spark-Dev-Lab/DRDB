/* jshint indent: 1 */

module.exports = function(sequelize, DataTypes) {
	return sequelize.define('Family', {
		id: {
			autoIncrement: true,
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true
		},
		NamePrimary: {
			type: DataTypes.STRING(50),
			allowNull: true
		},
		PrimaryGenderIdentity: {
			type: DataTypes.STRING(50),
			allowNull: true
		},
		DoBPrimary: {
			type: DataTypes.DATEONLY,
			allowNull: true
		},
		NameSecondary: {
			type: DataTypes.STRING(50),
			allowNull: true
		},
		SecondaryGenderIdentity: {
			type: DataTypes.STRING(50),
			allowNull: true
		},
		Email: {
			type: DataTypes.STRING(40),
			allowNull: true
		},
		Phone: {
			type: DataTypes.STRING(11),
			allowNull: true
		},
		CellPhone: {
			type: DataTypes.STRING(11),
			allowNull: true
		},
		RacePrimary: {
			type: DataTypes.STRING(20),
			allowNull: true
		},
		RaceSecondary: {
			type: DataTypes.STRING(20),
			allowNull: true
		},
		LanguagePrimary: {
			type: DataTypes.STRING(20),
			allowNull: true
		},
		LanguageSecondary: {
			type: DataTypes.STRING(20),
			allowNull: true
		},
		EnglishPercent: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		Note: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		PreferredContactMethods: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		PreferredContactTime: {
			type: DataTypes.STRING(255),
			allowNull: true
		},
		PreferredContactNotes: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		AutismHistory: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: 0
		},
		ASD: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: 0
		},
		HearingLoss: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: 0
		},
		VisionLoss: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: 0
		},
		PrematureBirth: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: 0
		},
		Illness: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: 0
		},
		Vehicle: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		Address: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		LastContactDate: {
			type: DataTypes.DATEONLY,
			allowNull: true
		},
		NextContactDate: {
			type: DataTypes.DATEONLY,
			allowNull: true
		},
		NextContactNote: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		RecruitmentMethod: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		BrochureSeen: {
			type: DataTypes.STRING(50),
			allowNull: true
		},
		BrochureLocation: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		AssignedLab: {
			type: DataTypes.INTEGER,
			allowNull: true,
			references: {
				model: {
					tableName: 'Lab',
				},
				key: 'id'
			}
		},
		CreatedBy: {
			type: DataTypes.INTEGER,
			allowNull: true,
			references: {
				model: {
					tableName: 'Personnel',
				},
				key: 'id'
			}
		},
		UpdatedBy: {
			type: DataTypes.INTEGER,
			allowNull: true,
			references: {
				model: {
					tableName: 'Personnel',
				},
				key: 'id'
			}
		},
		NoMoreContact: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: 0
		},
		TrainingSet: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
		},
		updatedAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
		}
	}, {
		sequelize,
		tableName: 'Family'
	});
};
