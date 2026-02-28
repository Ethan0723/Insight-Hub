import { buildContext, searchNewsRaw } from '../server/news_search.mjs';
import { generateDbOnlyAnswer } from '../server/rag_chat.mjs';

async function main() {
  const question = process.argv.slice(2).join(' ').trim() || '近期有哪些关税或支付相关的新闻？';
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const apiUrl = process.env.LLM_API_URL || '';
  const apiKey = process.env.LLM_API_KEY || '';
  const model = process.env.LLM_MODEL || 'bedrock-claude-4-5-sonnet';

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!apiUrl || !apiKey) {
    throw new Error('Missing LLM_API_URL or LLM_API_KEY');
  }

  const docs = await searchNewsRaw(question, {
    supabaseUrl,
    supabaseServiceRoleKey,
    days: 30,
    limit: 8
  });

  console.log(`命中条数: ${docs.length}`);
  console.log('sources:');
  docs.forEach((doc, idx) => {
    console.log(`${idx + 1}. ${doc.title} | ${doc.url}`);
  });

  if (docs.length === 0) {
    console.log('answer(<=200): 新闻库中未找到相关条目（最近30/180天），请换关键词或先补充RSS源。');
    return;
  }

  const context = buildContext(docs, 6000);
  const answer = await generateDbOnlyAnswer({
    question,
    context,
    apiUrl,
    apiKey,
    model
  });

  console.log(`answer(<=200): ${answer.slice(0, 200)}`);
}

main().catch((err) => {
  console.error('[verify_db_rag] failed:', err?.message || err);
  process.exit(1);
});
