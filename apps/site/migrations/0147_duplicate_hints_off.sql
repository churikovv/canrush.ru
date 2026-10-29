-- The duplicate check's hints (shop product names, same cover photo, «вкус входит в микс», migrations 0144/0145) are
-- off (`DUPLICATE_HINTS`): they made the model mistake a flavour for a mix that has it and filled the queue with
-- look-alikes. Their open «похоже»/«дубль» answers go, so the worker asks those drinks and cards again without them;
-- answers the team already cleared and automatic merges stay.
delete from "catalogCardCheck" where version = 2 and verdict in ('duplicate', 'unsure') and "dismissedAt" is null;
delete from "catalogDrinkCheck" where version = 2 and verdict in ('duplicate', 'unsure') and "dismissedAt" is null;
