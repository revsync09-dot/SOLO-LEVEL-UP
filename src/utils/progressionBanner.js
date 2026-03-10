const {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  TextDisplayBuilder,
} = require("discord.js");

const RANK_UP_BANNER_URL =
  "https://cdn.discordapp.com/attachments/1477018034169188362/1477030743736586342/565181ee-453c-4084-9b19-edccb5768403.png?ex=69a34793&is=69a1f613&hm=1e5381fb5f329a2ea4b4ec16d911419ee26b1f6ee19a2f96669b6b01157340f4&";

function hasProgress(progression) {
  if (!progression) return false;
  return progression.levelsGained > 0 || progression.rankChanged;
}

async function sendProgressionBanner(interaction, progression) {
  if (!hasProgress(progression)) return;

  const lines = ["**Rank up progress achieved**"];
  if (progression.levelsGained > 0) {
    lines.push(`Level ${progression.previousLevel} -> ${progression.newLevel} (+${progression.levelsGained})`);
  }
  if (progression.rankChanged) {
    lines.push(`Rank ${progression.previousRank} -> ${progression.newRank}`);
  }
  lines.push("Keep grinding dungeons, raids, and battles.");

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")))
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(RANK_UP_BANNER_URL))
    );

  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  };

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
      return;
    }
    await interaction.reply(payload);
  } catch (error) {
    if (error?.code === 40060 || error?.code === 10062) return;
    throw error;
  }
}

module.exports = { sendProgressionBanner };