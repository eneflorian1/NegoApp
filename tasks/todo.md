# Task: Fix VPS Redirection (negociator.site -> enef.site instead of NegoApp)

## 📋 Todo
- [ ] Investigate current redirection behavior (negociator.site) <!-- id: 0 -->
- [ ] Access VPS via SSH to inspect Nginx configuration <!-- id: 1 -->
- [ ] Check Nginx virtual host files for `negociator.site` and `enef.site` <!-- id: 2 -->
- [ ] Verify DNS records for `negociator.site` <!-- id: 3 -->
- [ ] Correct Nginx configuration to point `negociator.site` to the correct app port/directory <!-- id: 4 -->
- [ ] Restart Nginx and verify fix <!-- id: 5 -->

## 📝 Notes
- VPS IP: 155.117.45.192
- User: administrator
- Expected: negociator.site -> NegoApp
- Actual: negociator.site -> enef.site
- User mentioned changing DNS records recently.

## 🏁 Review
- (To be filled after implementation)
