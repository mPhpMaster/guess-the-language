<script lang="ts">
  import { tokenize } from '$lib/game/highlight';

  interface Props {
    text: string;
    /** Code renders highlighted and LTR; prose wraps and follows the text direction. */
    isCode: boolean;
    difficultyLabel: string;
    difficulty: string;
  }

  let { text, isCode, difficultyLabel, difficulty }: Props = $props();

  // Only tokenize actual code — prose questions render as plain text.
  const tokens = $derived(isCode ? tokenize(text) : []);
</script>

<div class="code-header">
  <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
  <span class="code-difficulty" data-diff={difficulty}>{difficultyLabel}</span>
</div>

<!--
  The highlighter returns tokens rather than an HTML string, so this renders
  through normal Svelte escaping — a snippet containing markup can never inject.
-->
<pre class="code-panel" class:as-text={!isCode} dir={isCode ? 'ltr' : 'auto'}><code
  >{#if isCode}{#each tokens as tok (tok)}<span class="tok-{tok.kind}">{tok.text}</span
      >{/each}{:else}{text}{/if}</code
></pre>
