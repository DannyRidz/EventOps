-- Parse bounded files by fields rather than one PL/pgSQL iteration per character.
create or replace function eventops_private.parse_import_csv(raw bytea) returns jsonb language plpgsql set search_path='' as $$
declare content text;part text[];token text;separator text;cell text;row_ text[]:='{}';rows_ jsonb[]:='{}';lines_ integer[]:='{}';headers jsonb;line integer:=1;first_line integer:=1;consumed integer:=0;
begin
 if octet_length(raw)>2097152 then raise sqlstate '22023' using message='File exceeds limit';end if;
 content:=convert_from(raw,'UTF8');if left(content,1)=chr(65279) then content:=substr(content,2);end if;
 for part in select regexp_matches(content,'("(?:[^"]|"")*"|[^",\r\n]*)(,|\r\n|\n|$)','g') loop
  token:=part[1];separator:=part[2];
  if token='' and separator='' then continue;end if;
  consumed:=consumed+length(token)+length(separator);
  cell:=case when left(token,1)='"' then replace(substr(token,2,length(token)-2),'""','"') else token end;
  if length(cell)>4096 or cardinality(row_)>=32 then raise sqlstate '22023' using message='Cell or column limit';end if;
  row_:=array_append(row_,cell);
  line:=line+length(token)-length(replace(token,E'\n',''));
  if separator<>',' then
   rows_:=array_append(rows_,to_jsonb(row_));lines_:=array_append(lines_,first_line);row_:='{}';
   if cardinality(rows_)>2002 then raise sqlstate '22023' using message='Row limit';end if;
   if separator<>'' then line:=line+1;end if;first_line:=line;
  end if;
 end loop;
 if consumed<>length(content) then raise sqlstate '22023' using message='Malformed CSV';end if;
 -- A final comma introduces an explicit empty field; an empty file has no headers.
 if cardinality(row_)>0 then
  if right(content,1)=',' then row_:=array_append(row_,'');end if;
  rows_:=array_append(rows_,to_jsonb(row_));lines_:=array_append(lines_,first_line);
 end if;
 headers:=rows_[1];
 if headers is null or jsonb_array_length(headers)>32 or exists(select 1 from jsonb_array_elements_text(headers) h where btrim(h)='') or (select count(distinct h) from jsonb_array_elements_text(headers) h)<>jsonb_array_length(headers) or exists(select 1 from unnest(rows_[2:]) r where jsonb_array_length(r)<>jsonb_array_length(headers)) then raise sqlstate '22023' using message='Invalid CSV headers or row width';end if;
 return jsonb_build_object('headers',headers,'rows',to_jsonb(rows_[2:]),'lines',to_jsonb(lines_[2:]));
end $$;
