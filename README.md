# 태환 ❤️ 선영 커플 허브

폰에서 둘이 같이 쓰는 데이트 리스트 웹앱입니다.

## 들어간 기능
- 데이트 리스트: 가고 싶어요 / 예정 / 다녀왔어요
- 카테고리: 맛집, 카페, 여행, **캠핑**, 액티비티, 영화, 기타
- 장소, 날짜, 예상 비용, 메모
- 태환 / 선영 / 함께 표시
- 즐겨찾기 ⭐
- 랜덤 데이트 뽑기 🎲
- 검색 + 카테고리/상태 필터
- 사진 최대 4장 첨부
- Supabase 연결 시 두 사람 폰에서 데이터 공유
- 공유 PIN 잠금
- 홈 화면 추가(PWA 기본 설정)

## 아주 쉬운 설치 순서
1. GitHub에 이 폴더 안의 파일을 그대로 올립니다.
2. Vercel에서 GitHub 저장소를 Import 합니다.
3. Supabase에서 새 프로젝트를 만들고 `supabase-setup.sql`을 SQL Editor에서 실행합니다.
4. Vercel 프로젝트 > Settings > Environment Variables에 아래 4개를 넣습니다.
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `COUPLE_PIN` (둘만 아는 숫자)
   - `COUPLE_CODE` = `taehwan-sunyoung`
5. Vercel에서 Redeploy 합니다.

Supabase 환경변수를 아직 넣지 않아도 사이트 자체는 실행되며, 그 경우 데이터는 현재 기기의 브라우저에만 저장됩니다.
