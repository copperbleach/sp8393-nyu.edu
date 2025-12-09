{\rtf1\ansi\ansicpg936\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import \{ VercelRequest, VercelResponse \} from '@vercel/node';\
import \{ createClient \} from '@supabase/supabase-js';\
\
const supabase = createClient(\
  process.env.SUPABASE_URL!,\
  process.env.SUPABASE_SERVICE_ROLE_KEY!\
);\
\
export default async function handler(req: VercelRequest, res: VercelResponse) \{\
  const \{ data, error \} = await supabase\
    .from('leaderboard')\
    .select('*')\
    .order('score', \{ ascending: false \})\
    .limit(10);\
\
  if (error) return res.status(500).json(\{ error \});\
\
  return res.status(200).json(data);\
\}\
}